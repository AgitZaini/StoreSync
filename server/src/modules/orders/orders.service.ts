import {
  ApprovalDecision,
  ApprovalEntity,
  FieldStockMovementType,
  OrderStatus,
  PharmacyStatus,
  UserRole,
  WarehouseMovementType,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor, spgIdFilter } from "../../utils/scope";
import { addBusinessDays, businessDate, startOfBusinessDay } from "../../utils/time";
import { notifyUser, notifyUsersByRole } from "../notifications/notifications.service";
import { applyFieldStockDelta, applyWarehouseDelta, orderCode } from "../stock/stock-ledger";
import type { CreateOrderInput, ItemQuantities, ListOrdersQuery, RecapQuery } from "./order.schemas";

type Tx = Prisma.TransactionClient;

const STATUS_LABEL: Record<OrderStatus, string> = {
  SUBMITTED: "diajukan",
  APPROVED: "disetujui",
  SHIPPED: "dikirim",
  RECEIVED: "diterima",
  REJECTED: "ditolak",
};

const orderSelect = {
  id: true,
  number: true,
  status: true,
  note: true,
  submittedAt: true,
  decidedAt: true,
  rejectReason: true,
  shippedAt: true,
  shipNote: true,
  receivedAt: true,
  receiveNote: true,
  hasDiscrepancy: true,
  discrepancyResolvedAt: true,
  discrepancyNote: true,
  spg: { select: { id: true, name: true, phone: true, team: { select: { id: true, name: true } } } },
  pharmacy: { select: { id: true, name: true, address: true } },
  shippedBy: { select: { id: true, name: true } },
  discrepancyResolvedBy: { select: { id: true, name: true } },
  items: {
    select: {
      id: true,
      requestedQty: true,
      stockAtSubmit: true,
      unfulfilledAtSubmit: true,
      approvedQty: true,
      shippedQty: true,
      receivedQty: true,
      product: { select: { id: true, code: true, name: true, unit: true } },
    },
    orderBy: { product: { name: "asc" } },
  },
} satisfies Prisma.OrderSelect;

type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
type OrderItemRow = OrderRow["items"][number];

/** Menambahkan kode order dan riwayat keputusan (Approval) untuk ditampilkan. */
const present = async (orders: OrderRow[]) => {
  const approvals = orders.length
    ? await prisma.approval.findMany({
        where: { entityType: ApprovalEntity.ORDER, entityId: { in: orders.map((order) => order.id) } },
        select: { id: true, entityId: true, step: true, decision: true, reason: true, decidedAt: true, approver: { select: { id: true, name: true } } },
        orderBy: { decidedAt: "asc" },
      })
    : [];

  return orders.map((order) => ({
    ...order,
    code: orderCode(order.number),
    approvals: approvals.filter((approval) => approval.entityId === order.id).map(({ entityId: _id, ...approval }) => approval),
  }));
};

const presentOne = async (order: OrderRow) => (await present([order]))[0];

/** Mengunci order selama transaksi supaya persetujuan/pengiriman/penerimaan tidak terjadi dua kali. */
const lockOrder = async (tx: Tx, orderId: string, expected: OrderStatus) => {
  await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;
  const order = await tx.order.findUnique({ where: { id: orderId }, select: orderSelect });

  if (!order) {
    throw new AppError(404, "Order tidak ditemukan");
  }

  if (order.status !== expected) {
    throw new AppError(409, `Order ${orderCode(order.number)} sudah ${STATUS_LABEL[order.status]}`);
  }

  return order;
};

/** Jumlah per item dari input; item yang tidak disebut memakai `fallback`, dan tidak boleh melebihi `max`. */
const resolveQuantities = (
  items: OrderItemRow[],
  overrides: ItemQuantities,
  fallback: (item: OrderItemRow) => number,
  max: ((item: OrderItemRow) => number) | null,
  label: string,
) => {
  const requested = new Map((overrides ?? []).map((entry) => [entry.itemId, entry.qty]));

  for (const itemId of requested.keys()) {
    if (!items.some((item) => item.id === itemId)) {
      throw new AppError(400, "Ada item yang bukan bagian dari order ini");
    }
  }

  return items.map((item) => {
    const qty = requested.get(item.id) ?? fallback(item);
    const limit = max?.(item);

    if (limit !== undefined && qty > limit) {
      throw new AppError(400, `Jumlah ${label} ${item.product.name} tidak boleh lebih dari ${limit}`);
    }

    return { item, qty };
  });
};

const describe = (lines: Array<{ item: OrderItemRow; qty: number }>) => lines.map(({ item, qty }) => `${item.product.name} × ${qty}`);

/** ORD-01: SPG mengajukan order untuk apotek tugasnya; kekurangan stok pusat dicatat sebagai permintaan belum terpenuhi. */
export const createOrder = async (input: CreateOrderInput, actor: AuditActor, context: AuditContext) => {
  const placement = await prisma.placement.findFirst({
    where: { spgId: actor.id, pharmacyId: input.pharmacyId, endedAt: null },
    select: { pharmacy: { select: { id: true, name: true, status: true } }, spg: { select: { name: true } } },
  });

  if (!placement) {
    throw new AppError(403, "Anda tidak ditugaskan di apotek ini");
  }

  if (placement.pharmacy.status !== PharmacyStatus.ACTIVE) {
    throw new AppError(400, "Apotek ini sedang tidak aktif");
  }

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((item) => item.productId) } },
    select: { id: true, name: true, isActive: true },
  });

  for (const item of input.items) {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new AppError(400, "Ada produk yang tidak ditemukan");
    if (!product.isActive) throw new AppError(400, `${product.name} sedang tidak dijual`);
  }

  const order = await prisma.$transaction(async (tx) => {
    const stocks = await tx.warehouseStock.findMany({ where: { productId: { in: products.map((product) => product.id) } } });
    const stockOf = (productId: string) => stocks.find((stock) => stock.productId === productId)?.qty ?? 0;

    const created = await tx.order.create({
      data: {
        spgId: actor.id,
        pharmacyId: placement.pharmacy.id,
        note: input.note || null,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId,
            requestedQty: item.qty,
            stockAtSubmit: stockOf(item.productId),
            unfulfilledAtSubmit: stockOf(item.productId) < item.qty,
          })),
        },
      },
      select: orderSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "order.submit",
      entity: "Order",
      entityId: created.id,
      after: {
        code: orderCode(created.number),
        pharmacyName: placement.pharmacy.name,
        items: created.items.map(
          (item) => `${item.product.name} × ${item.requestedQty}${item.unfulfilledAtSubmit ? ` (stok pusat ${item.stockAtSubmit})` : ""}`,
        ),
        note: input.note || undefined,
      },
      context,
    });

    return created;
  });

  const unfulfilled = order.items.filter((item) => item.unfulfilledAtSubmit).length;
  await notifyUsersByRole(
    [UserRole.SUPER_ADMIN],
    "Order baru",
    `${placement.spg.name} mengajukan ${orderCode(order.number)} untuk ${placement.pharmacy.name}` +
      (unfulfilled > 0 ? ` (${unfulfilled} produk melebihi stok pusat).` : "."),
    "/persetujuan",
  );

  return presentOne(order);
};

const findVisibleOrder = async (orderId: string, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const order = await prisma.order.findFirst({ where: { id: orderId, spgId: spgIdFilter(scope) }, select: orderSelect });

  if (!order) {
    throw new AppError(404, "Order tidak ditemukan");
  }

  return order;
};

export const getOrder = async (orderId: string, actor: AuditActor) => presentOne(await findVisibleOrder(orderId, actor));

/** Daftar order sesuai batas akses: SPG miliknya, TL timnya, Admin/SA semua. */
export const listOrders = async (query: ListOrdersQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const orders = await prisma.order.findMany({
    where: {
      AND: [
        { spgId: spgIdFilter(scope) },
        {
          spgId: query.spgId,
          pharmacyId: query.pharmacyId,
          status: query.status ? { in: query.status } : undefined,
          ...(query.openDiscrepancy ? { hasDiscrepancy: true, discrepancyResolvedAt: null } : {}),
        },
      ],
    },
    select: orderSelect,
    orderBy: { submittedAt: "desc" },
    take: 200,
  });

  return present(orders);
};

/** ORD-02: Super Admin menyetujui; jumlah disetujui boleh lebih kecil dari yang diminta. */
export const approveOrder = async (
  orderId: string,
  input: { items?: ItemQuantities; note?: string },
  actor: AuditActor,
  context: AuditContext,
) => {
  const order = await prisma.$transaction(async (tx) => {
    const pending = await lockOrder(tx, orderId, OrderStatus.SUBMITTED);
    const lines = resolveQuantities(pending.items, input.items, (item) => item.requestedQty, (item) => item.requestedQty, "disetujui");

    if (lines.every((line) => line.qty === 0)) {
      throw new AppError(400, "Setujui minimal satu produk, atau tolak order ini");
    }

    for (const { item, qty } of lines) {
      await tx.orderItem.update({ where: { id: item.id }, data: { approvedQty: qty } });
    }

    const updated = await tx.order.update({
      where: { id: pending.id },
      data: { status: OrderStatus.APPROVED, decidedAt: new Date() },
      select: orderSelect,
    });
    await tx.approval.create({
      data: {
        entityType: ApprovalEntity.ORDER,
        entityId: pending.id,
        step: UserRole.SUPER_ADMIN,
        decision: ApprovalDecision.APPROVED,
        reason: input.note || null,
        approverId: actor.id,
      },
    });
    await recordAudit(tx, {
      actor,
      action: "order.approve",
      entity: "Order",
      entityId: pending.id,
      before: { code: orderCode(pending.number), status: pending.status },
      after: {
        code: orderCode(pending.number),
        status: OrderStatus.APPROVED,
        items: lines.map(({ item, qty }) => `${item.product.name} × ${qty}${qty !== item.requestedQty ? ` (diminta ${item.requestedQty})` : ""}`),
        note: input.note || undefined,
      },
      context,
    });

    return updated;
  });

  const code = orderCode(order.number);
  const reduced = order.items.filter((item) => item.approvedQty !== item.requestedQty).length;
  await notifyUser(
    order.spg.id,
    "Order disetujui",
    `${code} untuk ${order.pharmacy.name} disetujui${reduced > 0 ? `; ${reduced} produk disetujui lebih sedikit dari permintaan` : ""}.`,
    "/order",
  );
  await notifyUsersByRole([UserRole.ADMIN], "Order siap dikirim", `${code} (${order.spg.name}, ${order.pharmacy.name}) sudah disetujui.`, "/order-masuk");

  return presentOne(order);
};

/** ORD-02: penolakan wajib beralasan dan terlihat oleh SPG. */
export const rejectOrder = async (orderId: string, reason: string, actor: AuditActor, context: AuditContext) => {
  const order = await prisma.$transaction(async (tx) => {
    const pending = await lockOrder(tx, orderId, OrderStatus.SUBMITTED);
    const updated = await tx.order.update({
      where: { id: pending.id },
      data: { status: OrderStatus.REJECTED, decidedAt: new Date(), rejectReason: reason },
      select: orderSelect,
    });
    await tx.approval.create({
      data: {
        entityType: ApprovalEntity.ORDER,
        entityId: pending.id,
        step: UserRole.SUPER_ADMIN,
        decision: ApprovalDecision.REJECTED,
        reason,
        approverId: actor.id,
      },
    });
    await recordAudit(tx, {
      actor,
      action: "order.reject",
      entity: "Order",
      entityId: pending.id,
      before: { code: orderCode(pending.number), status: pending.status },
      after: { code: orderCode(pending.number), status: OrderStatus.REJECTED, reason },
      context,
    });
    return updated;
  });

  await notifyUser(order.spg.id, "Order ditolak", `${orderCode(order.number)} untuk ${order.pharmacy.name} ditolak: ${reason}`, "/order");

  return presentOne(order);
};

/** ORD-03: Admin mengirim; stok pusat berkurang dan tidak bisa melebihi stok yang ada. */
export const shipOrder = async (
  orderId: string,
  input: { items?: ItemQuantities; note?: string },
  actor: AuditActor,
  context: AuditContext,
) => {
  const order = await prisma.$transaction(async (tx) => {
    const approved = await lockOrder(tx, orderId, OrderStatus.APPROVED);
    const lines = resolveQuantities(approved.items, input.items, (item) => item.approvedQty ?? 0, (item) => item.approvedQty ?? 0, "dikirim");

    if (lines.every((line) => line.qty === 0)) {
      throw new AppError(400, "Kirim minimal satu produk");
    }

    const date = businessDate();
    for (const { item, qty } of lines) {
      if (qty > 0) {
        await applyWarehouseDelta(tx, {
          productId: item.product.id,
          productName: item.product.name,
          delta: -qty,
          type: WarehouseMovementType.ORDER_SHIPPED,
          date,
          orderId: approved.id,
          actorId: actor.id,
        });
      }
      await tx.orderItem.update({ where: { id: item.id }, data: { shippedQty: qty } });
    }

    const updated = await tx.order.update({
      where: { id: approved.id },
      data: { status: OrderStatus.SHIPPED, shippedAt: new Date(), shippedById: actor.id, shipNote: input.note || null },
      select: orderSelect,
    });
    await recordAudit(tx, {
      actor,
      action: "order.ship",
      entity: "Order",
      entityId: approved.id,
      before: { code: orderCode(approved.number), status: approved.status },
      after: {
        code: orderCode(approved.number),
        status: OrderStatus.SHIPPED,
        items: lines.map(({ item, qty }) => `${item.product.name} × ${qty}${qty !== item.approvedQty ? ` (disetujui ${item.approvedQty})` : ""}`),
        note: input.note || undefined,
      },
      context,
    });
    return updated;
  });

  await notifyUser(
    order.spg.id,
    "Order dikirim",
    `${orderCode(order.number)} untuk ${order.pharmacy.name} sudah dikirim. Konfirmasi jumlahnya saat barang tiba.`,
    "/order",
  );

  return presentOne(order);
};

/** ORD-04: SPG mengonfirmasi jumlah yang benar-benar diterima; stok SPG di apotek itu bertambah. */
export const receiveOrder = async (
  orderId: string,
  input: { items?: ItemQuantities; note?: string },
  actor: AuditActor,
  context: AuditContext,
) => {
  const visible = await findVisibleOrder(orderId, actor);

  if (visible.spg.id !== actor.id) {
    throw new AppError(403, "Hanya SPG pemesan yang bisa mengonfirmasi penerimaan");
  }

  const order = await prisma.$transaction(async (tx) => {
    const shipped = await lockOrder(tx, orderId, OrderStatus.SHIPPED);
    const lines = resolveQuantities(shipped.items, input.items, (item) => item.shippedQty ?? 0, null, "diterima");
    const differences = lines.filter(({ item, qty }) => qty !== (item.shippedQty ?? 0));

    if (differences.length > 0 && !input.note) {
      throw new AppError(400, "Jumlah diterima berbeda dari yang dikirim. Jelaskan selisihnya di catatan.");
    }

    for (const { item, qty } of lines) {
      if (qty > 0) {
        await applyFieldStockDelta(tx, {
          holderId: shipped.spg.id,
          pharmacyId: shipped.pharmacy.id,
          productId: item.product.id,
          productName: item.product.name,
          delta: qty,
          type: FieldStockMovementType.ORDER_RECEIVED,
          orderId: shipped.id,
          actorId: actor.id,
        });
      }
      await tx.orderItem.update({ where: { id: item.id }, data: { receivedQty: qty } });
    }

    const updated = await tx.order.update({
      where: { id: shipped.id },
      data: {
        status: OrderStatus.RECEIVED,
        receivedAt: new Date(),
        receiveNote: input.note || null,
        hasDiscrepancy: differences.length > 0,
      },
      select: orderSelect,
    });
    await recordAudit(tx, {
      actor,
      action: "order.receive",
      entity: "Order",
      entityId: shipped.id,
      before: { code: orderCode(shipped.number), status: shipped.status },
      after: {
        code: orderCode(shipped.number),
        status: OrderStatus.RECEIVED,
        items: describe(lines),
        discrepancy: differences.map(({ item, qty }) => `${item.product.name}: dikirim ${item.shippedQty}, diterima ${qty}`),
        note: input.note || undefined,
      },
      context,
    });
    return updated;
  });

  if (order.hasDiscrepancy) {
    const lines = order.items
      .filter((item) => item.receivedQty !== item.shippedQty)
      .map((item) => `${item.product.name} dikirim ${item.shippedQty}, diterima ${item.receivedQty}`);
    await notifyUsersByRole(
      [UserRole.ADMIN],
      "Selisih penerimaan order",
      `${orderCode(order.number)} (${order.spg.name}, ${order.pharmacy.name}): ${lines.join("; ")}.`,
      "/order-masuk?tab=selisih",
    );
  }

  return presentOne(order);
};

/** Admin mencatat tindak lanjut selisih penerimaan (mis. sudah dicek dengan kurir). */
export const resolveDiscrepancy = async (orderId: string, note: string, actor: AuditActor, context: AuditContext) => {
  const order = await prisma.$transaction(async (tx) => {
    const received = await lockOrder(tx, orderId, OrderStatus.RECEIVED);

    if (!received.hasDiscrepancy) {
      throw new AppError(409, "Order ini tidak punya selisih penerimaan");
    }

    if (received.discrepancyResolvedAt) {
      throw new AppError(409, "Selisih order ini sudah ditindaklanjuti");
    }

    const updated = await tx.order.update({
      where: { id: received.id },
      data: { discrepancyResolvedAt: new Date(), discrepancyResolvedById: actor.id, discrepancyNote: note },
      select: orderSelect,
    });
    await recordAudit(tx, {
      actor,
      action: "order.resolve_discrepancy",
      entity: "Order",
      entityId: received.id,
      after: { code: orderCode(received.number), note },
      context,
    });
    return updated;
  });

  return presentOne(order);
};

/**
 * ORD-05: rekap permintaan belum terpenuhi per produk sebagai dasar pembelian ke pabrik.
 * "Perlu dibeli" = order yang belum dikirim − stok pusat sekarang; angka periode dihitung dari
 * order yang diajukan dalam rentang tanggal (order ditolak tidak dihitung).
 */
export const unfulfilledRecap = async (query: RecapQuery) => {
  const today = businessDate();
  const from = query.from ?? `${today.slice(0, 7)}-01`;
  const to = query.to ?? today;

  const [products, openItems, periodItems] = await Promise.all([
    prisma.product.findMany({
      select: { id: true, code: true, name: true, unit: true, isActive: true, warehouseStock: { select: { qty: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { in: [OrderStatus.SUBMITTED, OrderStatus.APPROVED] } } },
      select: { productId: true, requestedQty: true, approvedQty: true, orderId: true },
    }),
    prisma.orderItem.findMany({
      where: {
        order: {
          status: { not: OrderStatus.REJECTED },
          submittedAt: { gte: startOfBusinessDay(from), lt: startOfBusinessDay(addBusinessDays(to, 1)) },
        },
      },
      select: {
        productId: true,
        requestedQty: true,
        stockAtSubmit: true,
        unfulfilledAtSubmit: true,
        approvedQty: true,
        shippedQty: true,
        orderId: true,
      },
    }),
  ]);

  const rows = products
    .map(({ warehouseStock, ...product }) => {
      const warehouseQty = warehouseStock?.qty ?? 0;
      const open = openItems.filter((item) => item.productId === product.id);
      const period = periodItems.filter((item) => item.productId === product.id);
      const openQty = open.reduce((sum, item) => sum + (item.approvedQty ?? item.requestedQty), 0);
      const unfulfilled = period.filter((item) => item.unfulfilledAtSubmit);

      return {
        product,
        warehouseQty,
        openQty,
        openOrders: new Set(open.map((item) => item.orderId)).size,
        toPurchase: Math.max(0, openQty - warehouseQty),
        requestedQty: period.reduce((sum, item) => sum + item.requestedQty, 0),
        unfulfilledAtSubmitQty: unfulfilled.reduce((sum, item) => sum + Math.max(0, item.requestedQty - item.stockAtSubmit), 0),
        unfulfilledOrders: new Set(unfulfilled.map((item) => item.orderId)).size,
        shortShippedQty: period.reduce(
          (sum, item) => sum + (item.shippedQty !== null && item.approvedQty !== null ? Math.max(0, item.approvedQty - item.shippedQty) : 0),
          0,
        ),
      };
    })
    .filter((row) => row.openQty > 0 || row.unfulfilledAtSubmitQty > 0 || row.shortShippedQty > 0)
    .sort((a, b) => b.toPurchase - a.toPurchase || b.unfulfilledAtSubmitQty - a.unfulfilledAtSubmitQty || a.product.name.localeCompare(b.product.name));

  return {
    from,
    to,
    rows,
    totals: {
      toPurchase: rows.reduce((sum, row) => sum + row.toPurchase, 0),
      unfulfilledAtSubmitQty: rows.reduce((sum, row) => sum + row.unfulfilledAtSubmitQty, 0),
      shortShippedQty: rows.reduce((sum, row) => sum + row.shortShippedQty, 0),
    },
  };
};

/** Ringkasan untuk Beranda Super Admin/Admin. */
export const orderSummary = async () => {
  const [byStatus, openDiscrepancies] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], where: { status: { in: [OrderStatus.SUBMITTED, OrderStatus.APPROVED, OrderStatus.SHIPPED] } }, _count: { _all: true } }),
    prisma.order.count({ where: { hasDiscrepancy: true, discrepancyResolvedAt: null } }),
  ]);
  const count = (status: OrderStatus) => byStatus.find((group) => group.status === status)?._count._all ?? 0;

  return {
    submitted: count(OrderStatus.SUBMITTED),
    approved: count(OrderStatus.APPROVED),
    shipped: count(OrderStatus.SHIPPED),
    openDiscrepancies,
  };
};
