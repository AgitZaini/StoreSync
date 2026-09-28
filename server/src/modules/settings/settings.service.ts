import { z } from "zod";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import type { CreateDeductionRateInput, UpdateAttendanceSettingsInput, UpdateLeaveQuotaInput } from "./setting.schemas";

const LEAVE_QUOTA_KEY = "leave.teamLeaderAnnualQuotaDays";
const MAX_ACCURACY_KEY = "attendance.maxAccuracyM";
const LATE_TOLERANCE_KEY = "attendance.lateToleranceMinutes";

/** AB-12: jatah cuti Team Leader 15 hari per tahun, termasuk izin sakit. */
export const DEFAULT_LEAVE_QUOTA_DAYS = 15;
/** Akurasi GPS terburuk yang masih diterima; di atas ini lokasi tidak cukup pasti untuk radius 20 m. */
export const DEFAULT_MAX_ACCURACY_M = 100;
/** AB-04: jam absen dicatat apa adanya; toleransi hanya memengaruhi label "telat" di pemantauan. */
export const DEFAULT_LATE_TOLERANCE_MINUTES = 0;

const readIntSetting = async (key: string, fallback: number) => {
  const setting = await prisma.setting.findUnique({ where: { key } });
  const parsed = z.number().int().min(0).safeParse(setting?.value);
  return parsed.success ? parsed.data : fallback;
};

export const getLeaveQuotaDays = () => readIntSetting(LEAVE_QUOTA_KEY, DEFAULT_LEAVE_QUOTA_DAYS);

export const getAttendanceSettings = async () => ({
  maxAccuracyM: await readIntSetting(MAX_ACCURACY_KEY, DEFAULT_MAX_ACCURACY_M),
  lateToleranceMinutes: await readIntSetting(LATE_TOLERANCE_KEY, DEFAULT_LATE_TOLERANCE_MINUTES),
});

/** Tarif potongan yang berlaku pada waktu `at` (dipakai saat cuti disetujui, Tahap 8). */
export const getDeductionRateAt = (at: Date) =>
  prisma.deductionRate.findFirst({ where: { effectiveFrom: { lte: at } }, orderBy: { effectiveFrom: "desc" } });

export const getSettings = async () => {
  const [leaveQuotaDays, attendance, rates] = await Promise.all([
    getLeaveQuotaDays(),
    getAttendanceSettings(),
    prisma.deductionRate.findMany({ orderBy: { effectiveFrom: "desc" }, take: 20 }),
  ]);
  const creators = await prisma.user.findMany({
    where: { id: { in: [...new Set(rates.map((rate) => rate.createdById))] } },
    select: { id: true, name: true },
  });
  const creatorNames = new Map(creators.map((creator) => [creator.id, creator.name]));
  const deductionRates = rates.map((rate) => ({ ...rate, createdByName: creatorNames.get(rate.createdById) ?? null }));

  return { leaveQuotaDays, attendance, deductionRate: deductionRates[0] ?? null, deductionRates };
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

export const updateAttendanceSettings = async (
  input: UpdateAttendanceSettingsInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const before = await getAttendanceSettings();

  await prisma.$transaction(async (tx) => {
    for (const [key, value] of [
      [MAX_ACCURACY_KEY, input.maxAccuracyM],
      [LATE_TOLERANCE_KEY, input.lateToleranceMinutes],
    ] as const) {
      await tx.setting.upsert({
        where: { key },
        create: { key, value, updatedById: actor.id },
        update: { value, updatedById: actor.id },
      });
    }

    await recordAudit(tx, {
      actor,
      action: "setting.update_attendance",
      entity: "Setting",
      entityId: "attendance",
      before,
      after: input,
      context,
    });
  });

  return getSettings();
};
