import { OrderStatus, WarehouseMovementType } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { addBusinessDays, businessDate, startOfBusinessDay } from "../../utils/time";
import { applyWarehouseDelta, orderCode } from "../stock/stock-ledger";
import type { AdjustmentInput, InboundInput, MovementsQuery } from "./warehouse.schemas";

const productSelect = { id: true, code: true, name: true, unit: true, price: true, isActive: true } satisfies Prisma.ProductSelect;

/** Order yang belum dikirim (diajukan atau disetujui) per produk: kebutuhan yang akan mengurangi stok pusat. */
export const pendingOrderQtyByProduct = async () => {
  const items = await prisma.orderItem.findMany({
    where: { order: { status: { in: [OrderStatus.SUBMITTED, OrderStatus.APPROVED] } } },
    select: { productId: true, requestedQty: true, approvedQty: true },
  });
  const pending = new Map<string, number>();
  items.forEach((item) => pending.set(item.productId, (pending.get(item.productId) ?? 0) + (item.approvedQty ?? item.requestedQty)));
  return pending;
};

/** STK-01: stok pusat per produk aktif (plus produk nonaktif yang masih punya stok). */
export const listStock = async () => {
  const [products, pending] = await Promise.all([
    prisma.product.findMany({
      where: { OR: [{ isActive: true }, { warehouseStock: { qty: { gt: 0 } } }] },
      select: { ...productSelect, warehouseStock: { select: { qty: true, updatedAt: true } } },
      orderBy: { name: "asc" },
    }),
    pendingOrderQtyByProduct(),
  ]);

  return products.map(({ warehouseStock, ...product }) => ({
    product,
    qty: warehouseStock?.qty ?? 0,
    pendingOrderQty: pending.get(product.id) ?? 0,
    updatedAt: warehouseStock?.updatedAt ?? null,
  }));
};

/** STK-01: barang masuk dari pabrik (nomor PO opsional), bisa beberapa produk sekaligus. */
export const recordInbound = async (input: InboundInput, actor: AuditActor, context: AuditContext) => {
  if (input.date > businessDate()) {
    throw new AppError(400, "Tanggal barang masuk tidak boleh di masa depan");
  }

  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) } }, select: productSelect });
  const byId = new Map(products.map((product) => [product.id, product]));

  for (const item of input.items) {
    const product = byId.get(item.productId);
    if (!product) throw new AppError(400, "Ada produk yang tidak ditemukan");
    if (!product.isActive) throw new AppError(400, `${product.name} sedang nonaktif`);
  }

  return prisma.$transaction(async (tx) => {
    const movements = [];
    for (const item of input.items) {
      const product = byId.get(item.productId)!;
      const movement = await applyWarehouseDelta(tx, {
        productId: product.id,
        productName: product.name,
        delta: item.qty,
        type: WarehouseMovementType.INBOUND,
        date: input.date,
        poNumber: input.poNumber || null,
        note: input.note || null,
        actorId: actor.id,
      });
      movements.push({ ...movement, product: { id: product.id, name: product.name } });
    }

    await recordAudit(tx, {
      actor,
      action: "warehouse.inbound",
      entity: "WarehouseStock",
      after: {
        date: input.date,
        poNumber: input.poNumber || undefined,
        note: input.note || undefined,
        items: movements.map((movement) => `${movement.product.name} +${movement.qty} (stok ${movement.balanceAfter})`),
      },
      context,
    });

    return movements;
  });
};

/** Penyesuaian stok pusat (mis. rusak, hitung ulang) wajib beralasan dan tercatat. */
export const adjustStock = async (input: AdjustmentInput, actor: AuditActor, context: AuditContext) => {
  const product = await prisma.product.findUnique({ where: { id: input.productId }, select: productSelect });

  if (!product) {
    throw new AppError(404, "Produk tidak ditemukan");
  }

  return prisma.$transaction(async (tx) => {
    const movement = await applyWarehouseDelta(tx, {
      productId: product.id,
      productName: product.name,
      delta: input.qty,
      type: WarehouseMovementType.ADJUSTMENT,
      date: businessDate(),
      note: input.reason,
      actorId: actor.id,
    });

    await recordAudit(tx, {
      actor,
      action: "warehouse.adjust",
      entity: "WarehouseStock",
      entityId: product.id,
      before: { productName: product.name, qty: movement.balanceAfter - movement.qty },
      after: { productName: product.name, qty: movement.balanceAfter, reason: input.reason },
      context,
    });

    return movement;
  });
};

/** Riwayat mutasi stok pusat (terbaru dulu). */
export const listMovements = async (query: MovementsQuery) => {
  const movements = await prisma.warehouseMovement.findMany({
    where: {
      productId: query.productId,
      type: query.type,
      createdAt: {
        gte: query.from ? startOfBusinessDay(query.from) : undefined,
        lt: query.to ? startOfBusinessDay(addBusinessDays(query.to, 1)) : undefined,
      },
    },
    select: {
      id: true,
      type: true,
      qty: true,
      balanceAfter: true,
      date: true,
      poNumber: true,
      note: true,
      createdAt: true,
      product: { select: { id: true, code: true, name: true, unit: true } },
      createdBy: { select: { id: true, name: true } },
      order: { select: { id: true, number: true, spg: { select: { name: true } }, pharmacy: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 300,
  });

  return movements.map(({ order, ...movement }) => ({
    ...movement,
    order: order ? { id: order.id, code: orderCode(order.number), spgName: order.spg.name, pharmacyName: order.pharmacy.name } : null,
  }));
};
