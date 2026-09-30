import crypto from "node:crypto";
import { FileStatus, UserRole } from "@prisma/client";
import type { FileObject } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import type { AuditActor } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor } from "../../utils/scope";
import { storage } from "../../utils/storage";
import { businessDate } from "../../utils/time";
import { FILE_EXTENSIONS } from "./file.schemas";
import type { PresignFileInput } from "./file.schemas";

const FILE_NOT_FOUND = "Berkas tidak ditemukan";

/** Pengunggah, Admin, dan Super Admin selalu boleh; Team Leader boleh melihat berkas anggota timnya; Kasir foto retur apoteknya. */
const canAccessFile = async (actor: AuditActor, file: FileObject) => {
  if (file.uploadedById === actor.id || actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.ADMIN) {
    return true;
  }

  if (actor.role === UserRole.TEAM_LEADER) {
    const scope = await scopeFor(actor);
    return scope.kind === "team" && scope.spgIds.includes(file.uploadedById);
  }

  // Kasir melihat foto barang pada retur yang keluar dari apoteknya (RTR-02).
  if (actor.role === UserRole.KASIR) {
    const linked = await prisma.return.count({ where: { photoFileId: file.id, pharmacy: { kasirUserId: actor.id } } });
    return linked > 0;
  }

  return false;
};

export const createUpload = async (input: PresignFileInput, actor: AuditActor) => {
  const month = businessDate().slice(0, 7);
  const key = `${input.purpose.toLowerCase()}/${month}/${crypto.randomUUID()}.${FILE_EXTENSIONS[input.mimeType]}`;
  const uploadUrl = await storage.presignUpload(key, input.mimeType);

  const file = await prisma.fileObject.create({
    data: {
      key,
      purpose: input.purpose,
      mimeType: input.mimeType,
      size: input.size,
      uploadedById: actor.id,
    },
  });

  return {
    file,
    upload: {
      method: "PUT" as const,
      url: uploadUrl,
      headers: { "Content-Type": input.mimeType },
    },
  };
};

export const completeUpload = async (fileId: string, actor: AuditActor) => {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });

  if (!file || file.uploadedById !== actor.id) {
    throw new AppError(404, FILE_NOT_FOUND);
  }

  if (file.status === FileStatus.UPLOADED) {
    return file;
  }

  const stored = await storage.headObject(file.key);

  if (!stored) {
    throw new AppError(400, "Berkas belum terunggah");
  }

  if (stored.size !== file.size) {
    throw new AppError(400, "Ukuran berkas tidak sesuai dengan yang didaftarkan");
  }

  return prisma.fileObject.update({
    where: { id: file.id },
    data: { status: FileStatus.UPLOADED, uploadedAt: new Date() },
  });
};

export const getFile = async (fileId: string, actor: AuditActor) => {
  const file = await prisma.fileObject.findUnique({ where: { id: fileId } });

  if (!file || !(await canAccessFile(actor, file))) {
    throw new AppError(404, FILE_NOT_FOUND);
  }

  if (file.status !== FileStatus.UPLOADED) {
    throw new AppError(409, "Berkas belum selesai diunggah");
  }

  return { file, downloadUrl: await storage.presignDownload(file.key) };
};
