import { z } from "zod";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import type { CreateDeductionRateInput, UpdateLeaveQuotaInput } from "./setting.schemas";

const LEAVE_QUOTA_KEY = "leave.teamLeaderAnnualQuotaDays";
/** AB-12: jatah cuti Team Leader 15 hari per tahun, termasuk izin sakit. */
export const DEFAULT_LEAVE_QUOTA_DAYS = 15;

export const getLeaveQuotaDays = async () => {
  const setting = await prisma.setting.findUnique({ where: { key: LEAVE_QUOTA_KEY } });
  const parsed = z.number().int().min(0).safeParse(setting?.value);
  return parsed.success ? parsed.data : DEFAULT_LEAVE_QUOTA_DAYS;
};

/** Tarif potongan yang berlaku pada waktu `at` (dipakai saat cuti disetujui, Tahap 8). */
export const getDeductionRateAt = (at: Date) =>
  prisma.deductionRate.findFirst({ where: { effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: "desc" } });

export const getSettings = async () => {
  const [leaveQuotaDays, rates] = await Promise.all([
    getLeaveQuotaDays(),
    prisma.deductionRate.findMany({ orderBy: { effectiveFrom: "desc" }, take: 20 }),
  ]);
  const creators = await prisma.user.findMany({
    where: { id: { in: [...new Set(rates.map((rate) => rate.createdById))] } },
    select: { id: true, name: true },
  });
  const creatorNames = new Map(creators.map((creator) => [creator.id, creator.name]));
  const deductionRates = rates.map((rate) => ({ ...rate, createdByName: creatorNames.get(rate.createdById) ?? null }));

  return { leaveQuotaDays, deductionRate: deductionRates[0] ?? null, deductionRates };
};

export const updateLeaveQuota = async (input: UpdateLeaveQuotaInput, actor: AuditActor, context: AuditContext) => {
  const before = await getLeaveQuotaDays();

  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: LEAVE_QUOTA_KEY },
      create: { key: LEAVE_QUOTA_KEY, value: input.days, updatedById: actor.id },
      update: { value: input.days, updatedById: actor.id },
    });
    await recordAudit(tx, {
      actor,
      action: "setting.update_leave_quota",
      entity: "Setting",
      entityId: LEAVE_QUOTA_KEY,
      before: { days: before },
      after: { days: input.days },
      context,
    });
  });

  return getSettings();
};

/** AKN-05: tarif baru hanya berlaku untuk cuti yang disetujui setelahnya, jadi tarif lama tidak diubah. */
export const addDeductionRate = async (input: CreateDeductionRateInput, actor: AuditActor, context: AuditContext) => {
  const previous = await getDeductionRateAt(new Date());

  await prisma.$transaction(async (tx) => {
    const rate = await tx.deductionRate.create({ data: { amountPerDay: input.amountPerDay, createdById: actor.id } });
    await recordAudit(tx, {
      actor,
      action: "setting.add_deduction_rate",
      entity: "DeductionRate",
      entityId: rate.id,
      before: previous ? { amountPerDay: previous.amountPerDay } : undefined,
      after: { amountPerDay: rate.amountPerDay, effectiveFrom: rate.effectiveFrom },
      context,
    });
  });

  return getSettings();
};
