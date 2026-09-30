import {
  ApprovalDecision,
  ApprovalEntity,
  FieldStockMovementType,
  FilePurpose,
  FileStatus,
  PharmacyStatus,
  ReturnStatus,
  UserRole,
  WarehouseMovementType,
} from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor, spgDocumentWhere } from "../../utils/scope";
import { businessDate } from "../../utils/time";
import { lockUser } from "../attendance/attendance-checks";
import { approvalsFor, assertCashierPhotoUsable, kasirPharmacy, recordApproval } from "../approvals/cashier-approval";
import type { CashierIdentity } from "../approvals/cashier-approval";
import { notifyUser, notifyUsersByRole } from "../notifications/notifications.service";
import { assertWithinAvailable, fieldAvailability } from "../stock/field-availability";
import { applyFieldStockDelta, applyWarehouseDelta, returnCode } from "../stock/stock-ledger";
import type { CreateReturnInput, ListReturnsQuery, ReceiveReturnInput } from "./return.schemas";

type Tx = Prisma.TransactionClient;

const STATUS_LABEL: Record<ReturnStatus, string> = {
  SUBMITTED: "menunggu kasir",
  KASIR_APPROVED: "disetujui kasir",
  SA_APPROVED: "disetujui Super Admin",
  RECEIVED: "diterima gudang",
  REJECTED: "ditolak",
};

const returnSelect = {
  id: true,
  number: true,
  status: true,
  reason: true,
  photoFileId: true,
  submittedAt: true,
  kasirDecidedAt: true,
  saDecidedAt: true,
  rejectReason: true,
  rejectedStep: true,
  receivedAt: true,
  receiveNote: true,
  hasDiscrepancy: true,
  spg: { select: { id: true, name: true, phone: true, team: { select: { id: true, name: true } } } },
  pharmacy: { select: { id: true, name: true, address: true, kasirUserId: true } },
  receivedBy: { select: { id: true, name: true } },
  items: {
    select: { id: true, qty: true, receivedQty: true, product: { select: { id: true, code: true, name: true, unit: true } } },
    orderBy: { product: { name: "asc" } },
  },
} satisfies Prisma.ReturnSelect;

type ReturnRow = Prisma.ReturnGetPayload<{ select: typeof returnSelect }>;

const present = async (returns: ReturnRow[]) => {
  const approvals = await approvalsFor(ApprovalEntity.RETURN, returns.map((row) => row.id));
  return returns.map(({ pharmacy: { kasirUserId: _kasir, ...pharmacy }, ...row }) => ({
    ...row,
    pharmacy,
    code: returnCode(row.number),
    approvals: approvals.get(row.id) ?? [],
  }));
};

const presentOne = async (row: ReturnRow) => (await present([row]))[0];

const lines = (row: ReturnRow) => row.items.map((item) => ({ productId: item.product.id, productName: item.product.name, qty: item.qty }));
const describe = (row: ReturnRow) => row.items.map((item) => `${item.product.name} × ${item.qty}`);

/** RTR-01: SPG mengajukan retur dari apotek tugasnya; jumlah tidak boleh melebihi stok tersedia. Tujuan selalu gudang pusat (AB-08). */
export const createReturn = async (input: CreateReturnInput, actor: AuditActor, context: AuditContext) => {
  const placement = await prisma.placement.findFirst({
    where: { spgId: actor.id, pharmacyId: input.pharmacyId, endedAt: null },
    select: { spg: { select: { name: true } }, pharmacy: { select: { id: true, name: true, status: true, kasirUserId: true } } },
  });

  if (!placement) {
    throw new AppError(403, "Anda tidak ditugaskan di apotek ini");
  }

  if (placement.pharmacy.status !== PharmacyStatus.ACTIVE) {
    throw new AppError(400, "Apotek ini sedang tidak aktif");
  }

  if (input.photoFileId) {
    const file = await prisma.fileObject.findUnique({
      where: { id: input.photoFileId },
      select: { uploadedById: true, purpose: true, status: true, returnRecord: { select: { id: true } } },
    });

    if (!file || file.uploadedById !== actor.id || file.purpose !== FilePurpose.RETURN_PHOTO || file.status !== FileStatus.UPLOADED) {
      throw new AppError(400, "Foto barang tidak valid");
    }

    if (file.returnRecord) {
      throw new AppError(409, "Foto ini sudah dipakai retur lain");
    }
  }

  const products = await prisma.product.findMany({ where: { id: { in: input.items.map((item) => item.productId) } }, select: { id: true, name: true } });
  const items = input.items.map((item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    if (!product) throw new AppError(400, "Ada produk yang tidak ditemukan");
    return { productId: product.id, productName: product.name, qty: item.qty };
  });

  const created = await prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);
    assertWithinAvailable(items, await fieldAvailability(tx, { holderId: actor.id, pharmacyId: input.pharmacyId }));

    const row = await tx.return.create({
      data: {
        spgId: actor.id,
        pharmacyId: input.pharmacyId,
        reason: input.reason,
        photoFileId: input.photoFileId ?? null,
        items: { create: items.map(({ productId, qty }) => ({ productId, qty })) },
      },
      select: returnSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "return.submit",
      entity: "Return",
      entityId: row.id,
      after: { code: returnCode(row.number), pharmacyName: placement.pharmacy.name, reason: input.reason, items: describe(row) },
      evidenceFileIds: input.photoFileId ? [input.photoFileId] : [],
      context,
    });

    return row;
  });

  if (placement.pharmacy.kasirUserId) {
    await notifyUser(
      placement.pharmacy.kasirUserId,
      "Retur menunggu persetujuan",
      `${placement.spg.name} mengajukan ${returnCode(created.number)} (${describe(created).join(", ")}) untuk dikembalikan ke gudang pusat.`,
      "/persetujuan-kasir",
    );
  }

  return presentOne(created);
};

const lockReturn = async (tx: Tx, returnId: string, expected: ReturnStatus) => {
  await tx.$queryRaw`SELECT id FROM "Return" WHERE id = ${returnId} FOR UPDATE`;
  const row = await tx.return.findUnique({ where: { id: returnId }, select: returnSelect });

  if (!row) {
    throw new AppError(404, "Retur tidak ditemukan");
  }

  if (row.status !== expected) {
    throw new AppError(409, `Retur ${returnCode(row.number)} sudah ${STATUS_LABEL[row.status]}`);
  }

  return row;
};

/** RTR-02: kasir menyetujui barang keluar dari apoteknya, dengan nama + foto seperti JUL-03. */
export const kasirDecide = async (
  returnId: string,
  decision: ApprovalDecision,
  input: CashierIdentity & { reason?: string },
  actor: AuditActor,
  context: AuditContext,
) => {
  const pharmacy = await kasirPharmacy(actor);

  const row = await prisma.$transaction(async (tx) => {
    const pending = await lockReturn(tx, returnId, ReturnStatus.SUBMITTED);

    if (pending.pharmacy.id !== pharmacy.id) {
      throw new AppError(404, "Retur tidak ditemukan");
    }

    await assertCashierPhotoUsable(tx, actor.id, input.cashierPhotoFileId);

    const approved = decision === ApprovalDecision.APPROVED;
    if (approved) {
      assertWithinAvailable(lines(pending), await fieldAvailability(tx, { holderId: pending.spg.id, pharmacyId: pharmacy.id }, { returnId: pending.id }));
    }

    await recordApproval(tx, {
      entityType: ApprovalEntity.RETURN,
      entityId: pending.id,
      step: "KASIR",
      decision,
      reason: input.reason,
      approverId: actor.id,
      cashier: input,
    });
    const updated = await tx.return.update({
      where: { id: pending.id },
      data: approved
        ? { status: ReturnStatus.KASIR_APPROVED, kasirDecidedAt: new Date() }
        : { status: ReturnStatus.REJECTED, kasirDecidedAt: new Date(), rejectReason: input.reason, rejectedStep: "KASIR" },
      select: returnSelect,
    });

    await recordAudit(tx, {
      actor,
      action: approved ? "return.kasir_approve" : "return.kasir_reject",
      entity: "Return",
      entityId: pending.id,
      before: { code: returnCode(pending.number), status: pending.status },
      after: { code: returnCode(pending.number), status: updated.status, cashierName: input.cashierName, reason: input.reason },
      evidenceFileIds: [input.cashierPhotoFileId],
      context,
    });

    return updated;
  });

  const code = returnCode(row.number);
  if (decision === ApprovalDecision.APPROVED) {
    await notifyUsersByRole(
      [UserRole.SUPER_ADMIN],
      "Retur menunggu persetujuan",
      `${code} (${row.spg.name}, ${row.pharmacy.name}) sudah disetujui kasir ${input.cashierName}.`,
      "/persetujuan?tab=retur",
    );
  } else {
    await notifyUser(row.spg.id, "Retur ditolak kasir", `${code} di ${row.pharmacy.name} ditolak kasir ${input.cashierName}: ${input.reason}`, "/retur");
  }

  return presentOne(row);
};

/** RTR-03: Super Admin memutuskan setelah kasir menyetujui; penolakan wajib beralasan. */
export const saDecide = async (
  returnId: string,
  decision: ApprovalDecision,
  input: { note?: string; reason?: string },
  actor: AuditActor,
  context: AuditContext,
) => {
  const approved = decision === ApprovalDecision.APPROVED;

  const row = await prisma.$transaction(async (tx) => {
    const pending = await lockReturn(tx, returnId, ReturnStatus.KASIR_APPROVED);
    const reason = approved ? input.note || null : input.reason!;

    await recordApproval(tx, { entityType: ApprovalEntity.RETURN, entityId: pending.id, step: "SUPER_ADMIN", decision, reason, approverId: actor.id });
    const updated = await tx.return.update({
      where: { id: pending.id },
      data: approved
        ? { status: ReturnStatus.SA_APPROVED, saDecidedAt: new Date() }
        : { status: ReturnStatus.REJECTED, saDecidedAt: new Date(), rejectReason: reason, rejectedStep: "SUPER_ADMIN" },
      select: returnSelect,
    });

    await recordAudit(tx, {
      actor,
      action: approved ? "return.sa_approve" : "return.sa_reject",
      entity: "Return",
      entityId: pending.id,
      before: { code: returnCode(pending.number), status: pending.status },
      after: { code: returnCode(pending.number), status: updated.status, reason: reason ?? undefined },
      context,
    });

    return updated;
  });

  const code = returnCode(row.number);
  if (approved) {
    await notifyUsersByRole([UserRole.ADMIN], "Retur siap diterima gudang", `${code} (${row.spg.name}, ${row.pharmacy.name}): ${describe(row).join(", ")}.`, "/retur-masuk");
    await notifyUser(row.spg.id, "Retur disetujui", `${code} disetujui Super Admin. Kirim barangnya ke gudang pusat.`, "/retur");
  } else {
    await notifyUser(row.spg.id, "Retur ditolak", `${code} ditolak Super Admin: ${input.reason}`, "/retur");
  }

  return presentOne(row);
};

/**
 * RTR-04: Admin mengonfirmasi barang diterima gudang. Stok SPG berkurang sejumlah yang disetujui,
 * stok pusat bertambah sejumlah yang benar-benar diterima; bila berbeda, selisih ditandai untuk SA.
 */
export const receiveReturn = async (returnId: string, input: ReceiveReturnInput, actor: AuditActor, context: AuditContext) => {
  const row = await prisma.$transaction(async (tx) => {
    const approved = await lockReturn(tx, returnId, ReturnStatus.SA_APPROVED);
    const requested = new Map((input.items ?? []).map((entry) => [entry.itemId, entry.qty]));

    for (const itemId of requested.keys()) {
      if (!approved.items.some((item) => item.id === itemId)) {
        throw new AppError(400, "Ada item yang bukan bagian dari retur ini");
      }
    }

    const received = approved.items.map((item) => ({ item, qty: requested.get(item.id) ?? item.qty }));
    const differences = received.filter(({ item, qty }) => qty !== item.qty);

    if (differences.length > 0 && !input.note) {
      throw new AppError(400, "Jumlah diterima berbeda dari yang disetujui. Jelaskan selisihnya di catatan.");
    }

    const date = businessDate();
    for (const { item, qty } of received) {
      await applyFieldStockDelta(tx, {
        holderId: approved.spg.id,
        pharmacyId: approved.pharmacy.id,
        productId: item.product.id,
        productName: item.product.name,
        delta: -item.qty,
        type: FieldStockMovementType.RETURN_RECEIVED,
        returnId: approved.id,
        actorId: actor.id,
      });
      if (qty > 0) {
        await applyWarehouseDelta(tx, {
          productId: item.product.id,
          productName: item.product.name,
          delta: qty,
          type: WarehouseMovementType.RETURN_RECEIVED,
          date,
          note: `Retur ${returnCode(approved.number)}`,
          returnId: approved.id,
          actorId: actor.id,
        });
      }
      await tx.returnItem.update({ where: { id: item.id }, data: { receivedQty: qty } });
    }

    const updated = await tx.return.update({
      where: { id: approved.id },
      data: {
        status: ReturnStatus.RECEIVED,
        receivedAt: new Date(),
        receivedById: actor.id,
        receiveNote: input.note || null,
        hasDiscrepancy: differences.length > 0,
      },
      select: returnSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "return.receive",
      entity: "Return",
      entityId: approved.id,
      before: { code: returnCode(approved.number), status: approved.status },
      after: {
        code: returnCode(approved.number),
        status: ReturnStatus.RECEIVED,
        items: received.map(({ item, qty }) => `${item.product.name}: disetujui ${item.qty}, diterima ${qty}`),
        note: input.note || undefined,
      },
      context,
    });

    return updated;
  });

  const code = returnCode(row.number);
  await notifyUser(row.spg.id, "Retur diterima gudang", `${code} sudah diterima gudang pusat; sisa stok Anda di ${row.pharmacy.name} berkurang.`, "/retur");

  if (row.hasDiscrepancy) {
    const detail = row.items
      .filter((item) => item.receivedQty !== item.qty)
      .map((item) => `${item.product.name} disetujui ${item.qty}, diterima ${item.receivedQty}`);
    await notifyUsersByRole([UserRole.SUPER_ADMIN], "Selisih retur", `${code} (${row.spg.name}, ${row.pharmacy.name}): ${detail.join("; ")}.`, "/retur-masuk?tab=selesai");
  }

  return presentOne(row);
};

/** Daftar retur sesuai batas akses: SPG miliknya, TL timnya, Kasir apoteknya, Admin/SA semua. */
export const listReturns = async (query: ListReturnsQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const rows = await prisma.return.findMany({
    where: {
      AND: [
        spgDocumentWhere(scope),
        {
          spgId: query.spgId,
          pharmacyId: query.pharmacyId,
          status: query.status ? { in: query.status } : undefined,
          hasDiscrepancy: query.discrepancy,
        },
      ],
    },
    select: returnSelect,
    orderBy: { submittedAt: "desc" },
    take: 200,
  });

  return present(rows);
};

export const getReturn = async (returnId: string, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const row = await prisma.return.findFirst({ where: { AND: [{ id: returnId }, spgDocumentWhere(scope)] }, select: returnSelect });

  if (!row) {
    throw new AppError(404, "Retur tidak ditemukan");
  }

  return presentOne(row);
};

/** Ringkasan untuk Beranda Super Admin/Admin. */
export const returnSummary = async () => {
  const [awaitingKasir, awaitingSa, awaitingReceipt] = await Promise.all([
    prisma.return.count({ where: { status: ReturnStatus.SUBMITTED } }),
    prisma.return.count({ where: { status: ReturnStatus.KASIR_APPROVED } }),
    prisma.return.count({ where: { status: ReturnStatus.SA_APPROVED } }),
  ]);
  return { awaitingKasir, awaitingSa, awaitingReceipt };
};
