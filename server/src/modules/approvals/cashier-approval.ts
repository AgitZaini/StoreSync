import { FilePurpose, FileStatus, PharmacyStatus } from "@prisma/client";
import type { ApprovalDecision, ApprovalEntity, Prisma } from "@prisma/client";
import { z } from "zod";
import { AppError } from "../../middleware/error-handler";
import type { AuditActor } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { idSchema } from "../../utils/schemas";
import { faceCheckSchema } from "../attendance/attendance.schemas";

type Tx = Prisma.TransactionClient;

/** AB-07: akun kasir dipakai bersama per apotek, jadi setiap keputusan wajib nama + foto wajah kasir. */
export const cashierIdentitySchema = z.object({
  cashierName: z.string().trim().min(2, "Nama kasir wajib diisi").max(80),
  cashierPhotoFileId: idSchema,
  faceCheck: faceCheckSchema.optional(),
});

export const cashierRejectSchema = cashierIdentitySchema.extend({
  reason: z.string().trim().min(3, "Alasan penolakan wajib diisi").max(300),
});

export type CashierIdentity = z.infer<typeof cashierIdentitySchema>;

/** Apotek milik akun kasir yang sedang login. */
export const kasirPharmacy = async (actor: AuditActor) => {
  const pharmacy = await prisma.pharmacy.findUnique({ where: { kasirUserId: actor.id }, select: { id: true, name: true, status: true } });

  if (!pharmacy) {
    throw new AppError(403, "Akun kasir ini belum terhubung ke apotek");
  }

  if (pharmacy.status !== PharmacyStatus.ACTIVE) {
    throw new AppError(403, "Apotek ini sedang tidak aktif");
  }

  return pharmacy;
};

/** Foto kasir harus diunggah akun kasir ini, untuk keperluan foto kasir, dan belum dipakai keputusan lain. */
export const assertCashierPhotoUsable = async (tx: Tx, actorId: string, fileId: string) => {
  const file = await tx.fileObject.findUnique({
    where: { id: fileId },
    select: { uploadedById: true, purpose: true, status: true, approval: { select: { id: true } } },
  });

  if (!file || file.uploadedById !== actorId || file.purpose !== FilePurpose.CASHIER_PHOTO) {
    throw new AppError(400, "Foto kasir tidak valid");
  }

  if (file.status !== FileStatus.UPLOADED) {
    throw new AppError(400, "Foto kasir belum selesai diunggah");
  }

  if (file.approval) {
    throw new AppError(409, "Foto ini sudah dipakai. Ambil foto baru.");
  }
};

export const recordApproval = (
  tx: Tx,
  input: {
    entityType: ApprovalEntity;
    entityId: string;
    step: "KASIR" | "SUPER_ADMIN";
    decision: ApprovalDecision;
    approverId: string;
    reason?: string | null;
    cashier?: CashierIdentity;
  },
) =>
  tx.approval.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      step: input.step,
      decision: input.decision,
      reason: input.reason ?? null,
      approverId: input.approverId,
      cashierName: input.cashier?.cashierName ?? null,
      cashierPhotoFileId: input.cashier?.cashierPhotoFileId ?? null,
      cashierFaceCheck: input.cashier?.faceCheck ?? undefined,
    },
  });

/** Riwayat keputusan untuk sekumpulan dokumen, dikelompokkan per dokumen. */
export const approvalsFor = async (entityType: ApprovalEntity, entityIds: string[]) => {
  if (entityIds.length === 0) return new Map<string, ApprovalView[]>();

  const approvals = await prisma.approval.findMany({
    where: { entityType, entityId: { in: entityIds } },
    select: approvalSelect,
    orderBy: { decidedAt: "asc" },
  });
  const grouped = new Map<string, ApprovalView[]>();
  approvals.forEach(({ entityId, ...approval }) => grouped.set(entityId, [...(grouped.get(entityId) ?? []), approval]));
  return grouped;
};

const approvalSelect = {
  id: true,
  entityId: true,
  step: true,
  decision: true,
  reason: true,
  cashierName: true,
  cashierPhotoFileId: true,
  decidedAt: true,
  approver: { select: { id: true, name: true } },
} satisfies Prisma.ApprovalSelect;

export type ApprovalView = Omit<Prisma.ApprovalGetPayload<{ select: typeof approvalSelect }>, "entityId">;

