import { Prisma, UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor, spgIdFilter } from "../../utils/scope";
import type { UpsertTargetsInput } from "./target.schemas";

/**
 * Target omzet per SPG untuk satu bulan (AKN-04). Semua SPG aktif dalam batas akses ikut
 * ditampilkan, termasuk yang belum punya target, supaya Super Admin bisa mengisinya.
 */
export const listTargets = async (month: string, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const spgs = await prisma.user.findMany({
    where: {
      role: UserRole.SPG,
      id: spgIdFilter(scope),
      OR: [{ status: UserStatus.ACTIVE }, { salesTargets: { some: { month } } }],
    },
    select: {
      id: true,
      name: true,
      status: true,
      team: { select: { id: true, name: true } },
      salesTargets: { where: { month }, select: { amount: true, updatedAt: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const targets = spgs.map(({ salesTargets, ...spg }) => ({
    spg,
    amount: salesTargets[0]?.amount ?? null,
    updatedAt: salesTargets[0]?.updatedAt ?? null,
  }));
  const totalAmount = targets.reduce((sum, target) => sum.add(target.amount ?? 0), new Prisma.Decimal(0));

  return { month, targets, totalAmount };
};

export const upsertTargets = async (
  month: string,
  input: UpsertTargetsInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const spgIds = input.targets.map((target) => target.spgId);
  const spgs = await prisma.user.findMany({
    where: { id: { in: spgIds }, role: UserRole.SPG },
    select: { id: true, name: true },
  });

  if (spgs.length !== spgIds.length) {
    throw new AppError(400, "Target hanya bisa diatur untuk akun SPG");
  }

  const spgNames = new Map(spgs.map((spg) => [spg.id, spg.name]));

  await prisma.$transaction(async (tx) => {
    const existingTargets = await tx.salesTarget.findMany({ where: { month, spgId: { in: spgIds } } });
    const existingBySpg = new Map(existingTargets.map((target) => [target.spgId, target]));

    for (const { spgId, amount } of input.targets) {
      const existing = existingBySpg.get(spgId);
      const before = existing ? { amount: existing.amount } : null;
      const auditBase = { actor, entity: "SalesTarget", context };
      const label = { spgId, spgName: spgNames.get(spgId), month };

      if (amount === null) {
        if (existing) {
          await tx.salesTarget.delete({ where: { id: existing.id } });
          await recordAudit(tx, { ...auditBase, action: "target.delete", entityId: existing.id, before: { ...label, ...before } });
        }
        continue;
      }

      if (existing?.amount.equals(amount)) {
        continue;
      }

      const saved = await tx.salesTarget.upsert({
        where: { spgId_month: { spgId, month } },
        create: { spgId, month, amount },
        update: { amount },
      });
      await recordAudit(tx, {
        ...auditBase,
        action: "target.set",
        entityId: saved.id,
        before: before ? { ...label, ...before } : undefined,
        after: { ...label, amount: saved.amount },
      });
    }
  });

  return listTargets(month, actor);
};
