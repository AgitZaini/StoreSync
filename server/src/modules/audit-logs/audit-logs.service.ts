import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../utils/prisma";
import { dateSchema, idSchema } from "../../utils/schemas";
import { addBusinessDays, startOfBusinessDay } from "../../utils/time";

export const listAuditLogsQuerySchema = z.object({
  entity: z.string().trim().max(60).optional(),
  entityId: z.string().trim().max(120).optional(),
  actorId: idSchema.optional(),
  /** Awalan aksi, misalnya "user." atau "placement.create". */
  action: z.string().trim().max(80).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  cursor: idSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export const listAuditLogs = async (query: ListAuditLogsQuery) => {
  const where: Prisma.AuditLogWhereInput = {
    entity: query.entity,
    entityId: query.entityId,
    actorId: query.actorId,
    action: query.action ? { startsWith: query.action } : undefined,
    createdAt: {
      gte: query.from ? startOfBusinessDay(query.from) : undefined,
      lt: query.to ? startOfBusinessDay(addBusinessDays(query.to, 1)) : undefined,
    },
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const entries = rows.slice(0, query.limit);
  const actorIds = [...new Set(entries.map((entry) => entry.actorId).filter((id): id is string => Boolean(id)))];
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, role: true } });
  const actorsById = new Map(actors.map((actor) => [actor.id, actor]));

  return {
    entries: entries.map((entry) => ({ ...entry, actor: entry.actorId ? (actorsById.get(entry.actorId) ?? null) : null })),
    nextCursor: rows.length > query.limit ? entries[entries.length - 1].id : null,
  };
};
