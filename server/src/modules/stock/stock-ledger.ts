import crypto from "node:crypto";
import type { FieldStockMovementType, Prisma, WarehouseMovementType } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";

type Tx = Prisma.TransactionClient;
type QtyRow = { qty: number };

/**
 * Semua perubahan stok lewat dua fungsi ini: saldo diubah dengan satu pernyataan SQL atomik
 * (penambahan memakai upsert, pengurangan memakai `WHERE qty >= n`) lalu mutasinya dicatat
 * dengan saldo sesudahnya. Dengan begitu stok tidak pernah minus walau ada request bersamaan.
 */

export const applyWarehouseDelta = async (
  tx: Tx,
  input: {
    productId: string;
    productName: string;
    delta: number;
    type: WarehouseMovementType;
    date: string;
    actorId: string;
    poNumber?: string | null;
    note?: string | null;
    orderId?: string | null;
  },
) => {
  let rows: QtyRow[];

  if (input.delta >= 0) {
    rows = await tx.$queryRaw<QtyRow[]>`
      INSERT INTO "WarehouseStock" ("id", "productId", "qty", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${input.productId}, ${input.delta}, NOW())
      ON CONFLICT ("productId") DO UPDATE SET "qty" = "WarehouseStock"."qty" + EXCLUDED."qty", "updatedAt" = NOW()
      RETURNING "qty"`;
  } else {
    rows = await tx.$queryRaw<QtyRow[]>`
      UPDATE "WarehouseStock" SET "qty" = "qty" + ${input.delta}, "updatedAt" = NOW()
      WHERE "productId" = ${input.productId} AND "qty" >= ${-input.delta}
      RETURNING "qty"`;

    if (rows.length === 0) {
      const current = await tx.warehouseStock.findUnique({ where: { productId: input.productId }, select: { qty: true } });
      throw new AppError(
        409,
        `Stok pusat ${input.productName} tidak cukup (tersedia ${current?.qty ?? 0}, dibutuhkan ${-input.delta})`,
        "INSUFFICIENT_STOCK",
        { productId: input.productId, available: current?.qty ?? 0, needed: -input.delta },
      );
    }
  }

  const balanceAfter = rows[0].qty;
  const movement = await tx.warehouseMovement.create({
    data: {
      productId: input.productId,
      type: input.type,
      qty: input.delta,
      balanceAfter,
      date: input.date,
      poNumber: input.poNumber ?? null,
      note: input.note ?? null,
      orderId: input.orderId ?? null,
      createdById: input.actorId,
    },
    select: { id: true, qty: true, balanceAfter: true },
  });

  return movement;
};

export const applyFieldStockDelta = async (
  tx: Tx,
  input: {
    holderId: string;
    pharmacyId: string;
    productId: string;
    productName: string;
    delta: number;
    type: FieldStockMovementType;
    actorId: string;
    note?: string | null;
    orderId?: string | null;
  },
) => {
  let rows: QtyRow[];

  if (input.delta >= 0) {
    rows = await tx.$queryRaw<QtyRow[]>`
      INSERT INTO "FieldStock" ("id", "holderId", "pharmacyId", "productId", "qty", "updatedAt")
      VALUES (${crypto.randomUUID()}, ${input.holderId}, ${input.pharmacyId}, ${input.productId}, ${input.delta}, NOW())
      ON CONFLICT ("holderId", "pharmacyId", "productId")
      DO UPDATE SET "qty" = "FieldStock"."qty" + EXCLUDED."qty", "updatedAt" = NOW()
      RETURNING "qty"`;
  } else {
    rows = await tx.$queryRaw<QtyRow[]>`
      UPDATE "FieldStock" SET "qty" = "qty" + ${input.delta}, "updatedAt" = NOW()
      WHERE "holderId" = ${input.holderId} AND "pharmacyId" = ${input.pharmacyId} AND "productId" = ${input.productId}
        AND "qty" >= ${-input.delta}
      RETURNING "qty"`;

    if (rows.length === 0) {
      throw new AppError(409, `Sisa stok ${input.productName} tidak cukup`, "INSUFFICIENT_FIELD_STOCK");
    }
  }

  return tx.fieldStockMovement.create({
    data: {
      holderId: input.holderId,
      pharmacyId: input.pharmacyId,
      productId: input.productId,
      type: input.type,
      qty: input.delta,
      balanceAfter: rows[0].qty,
      note: input.note ?? null,
      orderId: input.orderId ?? null,
      createdById: input.actorId,
    },
    select: { id: true, qty: true, balanceAfter: true },
  });
};

/** Nomor order untuk ditampilkan, mis. ORD-000123. */
export const orderCode = (number: number) => `ORD-${String(number).padStart(6, "0")}`;
