import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import type { Request } from "express";

type AuditClient = Prisma.TransactionClient | PrismaClient;

export type AuditActor = { id: string; role: UserRole };
export type AuditContext = { ip?: string; userAgent?: string };

export type AuditInput = {
  actor: AuditActor | null;
  /** Format `<entitas>.<aksi>`, misalnya `user.create` atau `auth.login`. */
  action: string;
  entity: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  evidenceFileIds?: string[];
  context?: AuditContext;
};

const SENSITIVE_KEYS = new Set(["passwordHash", "tokenHash"]);

const toAuditJson = (value: unknown): Prisma.InputJsonValue | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return JSON.parse(JSON.stringify(value, (key, nested) => (SENSITIVE_KEYS.has(key) ? undefined : nested)));
};

export const auditContext = (req: Request): AuditContext => ({
  ip: req.ip,
  userAgent: req.get("user-agent") ?? undefined,
});

/**
 * Mencatat riwayat (LOG-01). Panggil dengan `tx` dari `prisma.$transaction`
 * supaya riwayat tersimpan bersama perubahan datanya, atau gagal bersamanya.
 */
export const recordAudit = (db: AuditClient, input: AuditInput) =>
  db.auditLog.create({
    data: {
      actorId: input.actor?.id,
      actorRole: input.actor?.role,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      before: toAuditJson(input.before),
      after: toAuditJson(input.after),
      evidenceFileIds: input.evidenceFileIds ?? [],
      ip: input.context?.ip,
      userAgent: input.context?.userAgent,
    },
  });
