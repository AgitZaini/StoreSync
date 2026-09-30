import { FieldStockMovementType, OrderStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor } from "../../utils/scope";
import type { DataScope } from "../../utils/scope";
import { lockUser } from "../attendance/attendance-checks";
import { notifyUser } from "../notifications/notifications.service";
import { applyFieldStockDelta, orderCode } from "../stock/stock-ledger";
import type { FieldMovementsQuery, FieldStockQuery, OpeningStockInput } from "./field-stock.schemas";

const holderSelect = { id: true, name: true, role: true, team: { select: { id: true, name: true } } } satisfies Prisma.UserSelect;
const productSelect = { id: true, code: true, name: true, unit: true, price: true } satisfies Prisma.ProductSelect;

/** Pemegang stok yang boleh dilihat: SPG dirinya, TL timnya (dan stok atas namanya sendiri), Admin/SA semua. */
const holderFilter = (scope: DataScope, actor: AuditActor): string | { in: string[] } | undefined => {
  switch (scope.kind) {
    case "all":
      return undefined;
    case "team":
      return { in: [...scope.spgIds, actor.id] };
    case "self":
      return scope.userId;
    case "pharmacy":
      return { in: [] };
  }
};

const pairKey = (holderId: string, pharmacyId: string) => `${holderId}:${pharmacyId}`;

/**
 * Sisa stok per pemegang per apotek (AB-05), termasuk penempatan aktif yang belum punya stok
 * supaya Admin bisa mengisi stok awal. `openingLocked` = sudah ada transaksi selain stok awal.
 */
export const listFieldStock = async (query: FieldStockQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const scoped = holderFilter(scope, actor);
  const holderWhere = { AND: [{ holderId: scoped }, { holderId: query.holderId }] };

  const [placements, stocks, activity] = await Promise.all([
    prisma.placement.findMany({
      where: { endedAt: null, pharmacyId: query.pharmacyId, AND: [{ spgId: scoped }, { spgId: query.holderId }] },
      select: { id: true, spg: { select: holderSelect }, pharmacy: { select: { id: true, name: true } } },
    }),
    prisma.fieldStock.findMany({
      where: { ...holderWhere, pharmacyId: query.pharmacyId },
      select: { holderId: true, pharmacyId: true, qty: true, updatedAt: true, product: { select: productSelect }, holder: { select: holderSelect }, pharmacy: { select: { id: true, name: true } } },
    }),
    prisma.fieldStockMovement.groupBy({
      by: ["holderId", "pharmacyId", "type"],
      where: { ...holderWhere, pharmacyId: query.pharmacyId },
      _count: { _all: true },
    }),
  ]);

  type Group = {
    holder: Prisma.UserGetPayload<{ select: typeof holderSelect }>;
    pharmacy: { id: string; name: string };
    placementId: string | null;
    items: Array<{ product: (typeof stocks)[number]["product"]; qty: number; updatedAt: Date }>;
  };
  const groups = new Map<string, Group>();
  const groupFor = (holder: Group["holder"], pharmacy: Group["pharmacy"]) => {
    const key = pairKey(holder.id, pharmacy.id);
    if (!groups.has(key)) groups.set(key, { holder, pharmacy, placementId: null, items: [] });
    return groups.get(key)!;
  };

  placements.forEach((placement) => (groupFor(placement.spg, placement.pharmacy).placementId = placement.id));
  stocks.forEach((stock) => groupFor(stock.holder, stock.pharmacy).items.push({ product: stock.product, qty: stock.qty, updatedAt: stock.updatedAt }));

  return [...groups.values()]
    .map((group) => {
      const types = activity.filter((row) => row.holderId === group.holder.id && row.pharmacyId === group.pharmacy.id).map((row) => row.type);
      return {
        ...group,
        items: group.items.sort((a, b) => a.product.name.localeCompare(b.product.name)),
        totalQty: group.items.reduce((sum, item) => sum + item.qty, 0),
        hasOpening: types.includes(FieldStockMovementType.OPENING),
        openingLocked: types.some((type) => type !== FieldStockMovementType.OPENING),
      };
    })
    .filter((group) => group.placementId || group.totalQty > 0 || group.items.length > 0)
    .sort((a, b) => a.holder.name.localeCompare(b.holder.name) || a.pharmacy.name.localeCompare(b.pharmacy.name));
};

/** Riwayat ledger stok satu pemegang di satu apotek (terbaru dulu). */
export const listMovements = async (query: FieldMovementsQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const scoped = holderFilter(scope, actor);
  const allowed = scoped === undefined || (typeof scoped === "string" ? scoped === query.holderId : scoped.in.includes(query.holderId));

  if (!allowed) {
    throw new AppError(404, "Data stok tidak ditemukan");
  }

  const movements = await prisma.fieldStockMovement.findMany({
    where: { holderId: query.holderId, pharmacyId: query.pharmacyId, productId: query.productId },
    select: {
      id: true,
      type: true,
      qty: true,
      balanceAfter: true,
      note: true,
      createdAt: true,
      product: { select: { id: true, code: true, name: true, unit: true } },
      createdBy: { select: { id: true, name: true } },
      order: { select: { id: true, number: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return movements.map(({ order, ...movement }) => ({ ...movement, order: order ? { id: order.id, code: orderCode(order.number) } : null }));
};

/**
 * Stok awal saat go-live, per SPG per apotek tugas, diisi Admin (ber-riwayat). Bisa diubah selama
 * belum ada transaksi lain di pasangan itu; setelahnya perubahan lewat koreksi stock opname (Tahap 7).
 */
export const setOpeningStock = async (input: OpeningStockInput, actor: AuditActor, context: AuditContext) => {
  const placement = await prisma.placement.findFirst({
    where: { spgId: input.spgId, pharmacyId: input.pharmacyId, endedAt: null },
    select: { id: true, spg: { select: { id: true, name: true } }, pharmacy: { select: { id: true, name: true } } },
  });

  if (!placement) {
    throw new AppError(400, "SPG ini tidak sedang ditempatkan di apotek tersebut");
  }

  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) } }, select: { id: true, name: true } });

  if (products.length !== input.items.length) {
    throw new AppError(400, "Ada produk yang tidak ditemukan");
  }

  const changes = await prisma.$transaction(async (tx) => {
    await lockUser(tx, input.spgId);

    const activity = await tx.fieldStockMovement.count({
      where: { holderId: input.spgId, pharmacyId: input.pharmacyId, type: { not: FieldStockMovementType.OPENING } },
    });

    if (activity > 0) {
      throw new AppError(409, "Stok awal sudah terkunci karena sudah ada transaksi stok di apotek ini", "OPENING_LOCKED");
    }

    const current = await tx.fieldStock.findMany({
      where: { holderId: input.spgId, pharmacyId: input.pharmacyId, productId: { in: products.map((product) => product.id) } },
      select: { productId: true, qty: true },
    });
    const lines: string[] = [];

    for (const item of input.items) {
      const product = products.find((candidate) => candidate.id === item.productId)!;
      const before = current.find((stock) => stock.productId === item.productId)?.qty ?? 0;
      if (item.qty === before) continue;

      await applyFieldStockDelta(tx, {
        holderId: input.spgId,
        pharmacyId: input.pharmacyId,
        productId: product.id,
        productName: product.name,
        delta: item.qty - before,
        type: FieldStockMovementType.OPENING,
        note: "Stok awal",
        actorId: actor.id,
      });
      lines.push(`${product.name}: ${before} → ${item.qty}`);
    }

    if (lines.length > 0) {
      await recordAudit(tx, {
        actor,
        action: "field_stock.opening",
        entity: "FieldStock",
        entityId: placement.id,
        after: { spgName: placement.spg.name, pharmacyName: placement.pharmacy.name, items: lines },
        context,
      });
    }

    return lines;
  });

  if (changes.length > 0) {
    await notifyUser(placement.spg.id, "Stok awal diisi", `Admin mengisi stok awal Anda di ${placement.pharmacy.name}.`, "/stok-saya");
  }

  const [group] = await listFieldStock({ holderId: input.spgId, pharmacyId: input.pharmacyId }, actor);
  return { changes, stock: group ?? null };
};

/**
 * Guard sementara sebelum serah terima (Tahap 7): penempatan tidak bisa dilepas selama SPG masih
 * memegang stok di apotek itu atau masih ada order yang belum selesai.
 */
export const assertPlacementReleasable = async (spgId: string, pharmacyId: string) => {
  const [stock, openOrders] = await Promise.all([
    prisma.fieldStock.aggregate({ where: { holderId: spgId, pharmacyId }, _sum: { qty: true } }),
    prisma.order.findMany({
      where: { spgId, pharmacyId, status: { in: [OrderStatus.SUBMITTED, OrderStatus.APPROVED, OrderStatus.SHIPPED] } },
      select: { number: true },
      orderBy: { number: "asc" },
      take: 3,
    }),
  ]);

  if (openOrders.length > 0) {
    throw new AppError(
      409,
      `Masih ada order yang belum selesai (${openOrders.map((order) => orderCode(order.number)).join(", ")}). Selesaikan atau tolak dulu.`,
      "OPEN_ORDERS",
    );
  }

  const remaining = stock._sum.qty ?? 0;
  if (remaining > 0) {
    throw new AppError(
      409,
      `SPG masih memegang ${remaining} barang di apotek ini. Stok harus diserahterimakan dulu sebelum penempatan dilepas.`,
      "FIELD_STOCK_REMAINING",
    );
  }
};
