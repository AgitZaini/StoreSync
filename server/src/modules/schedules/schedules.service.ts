import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { scopeFor, spgIdFilter } from "../../utils/scope";
import { addBusinessDays, startOfBusinessDay, weekDates } from "../../utils/time";
import { notifyUser } from "../notifications/notifications.service";
import type { SaveScheduleWeekInput, ScheduleValue, ScheduleWeekQuery } from "./schedule.schemas";

type Ref = { id: string; name: string };
type PlacementPeriod = { startedAt: Date; endedAt: Date | null };

const spgSelect = { id: true, name: true, status: true, team: { select: { id: true, name: true } } } satisfies Prisma.UserSelect;
const pharmacySelect = {
  id: true,
  name: true,
  is24h: true,
  openTime: true,
  closeTime: true,
} satisfies Prisma.PharmacySelect;

const pairKey = (spgId: string, pharmacyId: string) => `${spgId}:${pharmacyId}`;

/** Tanggal-tanggal dalam `dates` saat SPG punya penempatan di apotek itu. */
const datesCoveredBy = (periods: PlacementPeriod[], dates: string[]) =>
  dates.filter((date) => {
    const dayStart = startOfBusinessDay(date);
    const dayEnd = startOfBusinessDay(addBusinessDays(date, 1));
    return periods.some((period) => period.startedAt < dayEnd && (!period.endedAt || period.endedAt >= dayStart));
  });

const toValue = (schedule: { isOff: boolean; startTime: string | null; endTime: string | null }): ScheduleValue => ({
  isOff: schedule.isOff,
  startTime: schedule.startTime,
  endTime: schedule.endTime,
});

const sameValue = (a: ScheduleValue, b: ScheduleValue) =>
  a.isOff === b.isOff && a.startTime === b.startTime && a.endTime === b.endTime;

/**
 * Jadwal satu minggu (Senin–Minggu) per pasangan SPG–apotek. SPG hanya melihat jadwalnya,
 * Team Leader timnya, Admin/Super Admin semua (JDW-02, AKN-06).
 */
export const getWeek = async (query: ScheduleWeekQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);
  const dates = weekDates(query.weekStart);
  const weekStartAt = startOfBusinessDay(query.weekStart);
  const weekEndAt = startOfBusinessDay(addBusinessDays(query.weekStart, 7));
  const spgWhere: Prisma.UserWhereInput | undefined = query.teamId ? { teamId: query.teamId } : undefined;

  const [placements, schedules] = await Promise.all([
    prisma.placement.findMany({
      where: {
        spgId: spgIdFilter(scope),
        pharmacyId: query.pharmacyId,
        spg: spgWhere,
        startedAt: { lt: weekEndAt },
        OR: [{ endedAt: null }, { endedAt: { gte: weekStartAt } }],
      },
      select: { startedAt: true, endedAt: true, spg: { select: spgSelect }, pharmacy: { select: pharmacySelect } },
    }),
    prisma.schedule.findMany({
      where: { date: { in: dates }, spgId: spgIdFilter(scope), pharmacyId: query.pharmacyId, spg: spgWhere },
      select: {
        date: true,
        isOff: true,
        startTime: true,
        endTime: true,
        updatedAt: true,
        spg: { select: spgSelect },
        pharmacy: { select: pharmacySelect },
      },
    }),
  ]);

  type Row = {
    spg: (typeof placements)[number]["spg"];
    pharmacy: (typeof placements)[number]["pharmacy"];
    periods: PlacementPeriod[];
    entries: Record<string, ScheduleValue & { updatedAt: Date }>;
  };
  const rows = new Map<string, Row>();
  const rowFor = (spg: Row["spg"], pharmacy: Row["pharmacy"]) => {
    const key = pairKey(spg.id, pharmacy.id);
    if (!rows.has(key)) rows.set(key, { spg, pharmacy, periods: [], entries: {} });
    return rows.get(key)!;
  };

  placements.forEach((placement) => rowFor(placement.spg, placement.pharmacy).periods.push(placement));
  schedules.forEach((schedule) => {
    rowFor(schedule.spg, schedule.pharmacy).entries[schedule.date] = { ...toValue(schedule), updatedAt: schedule.updatedAt };
  });

  return {
    weekStart: query.weekStart,
    dates,
    rows: [...rows.values()]
      .sort((a, b) => a.spg.name.localeCompare(b.spg.name) || a.pharmacy.name.localeCompare(b.pharmacy.name))
      .map(({ periods, ...row }) => ({ ...row, availableDates: datesCoveredBy(periods, dates) })),
  };
};

/** JDW-01: hanya Admin yang mengisi dan mengubah jadwal; setiap perubahan tercatat. */
export const saveWeek = async (
  weekStart: string,
  input: SaveScheduleWeekInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const dates = weekDates(weekStart);
  const outsideWeek = input.entries.find((entry) => !dates.includes(entry.date));

  if (outsideWeek) {
    throw new AppError(400, `Tanggal ${outsideWeek.date} di luar minggu ${weekStart}`);
  }

  const keys = new Set(input.entries.map((entry) => `${pairKey(entry.spgId, entry.pharmacyId)}:${entry.date}`));

  if (keys.size !== input.entries.length) {
    throw new AppError(400, "Ada jadwal ganda untuk SPG, apotek, dan tanggal yang sama");
  }

  const pairs = [...new Map(input.entries.map((entry) => [pairKey(entry.spgId, entry.pharmacyId), entry])).values()];
  const placements = await prisma.placement.findMany({
    where: { OR: pairs.map(({ spgId, pharmacyId }) => ({ spgId, pharmacyId })) },
    select: { spgId: true, pharmacyId: true, startedAt: true, endedAt: true, spg: { select: { name: true } }, pharmacy: { select: { name: true } } },
  });
  const periodsByPair = new Map<string, PlacementPeriod[]>();
  const names = new Map<string, { spg: string; pharmacy: string }>();
  placements.forEach((placement) => {
    const key = pairKey(placement.spgId, placement.pharmacyId);
    periodsByPair.set(key, [...(periodsByPair.get(key) ?? []), placement]);
    names.set(key, { spg: placement.spg.name, pharmacy: placement.pharmacy.name });
  });

  // Jadwal hanya untuk hari saat SPG ditempatkan di apotek itu; menghapus jadwal lama tetap boleh.
  for (const entry of input.entries) {
    const key = pairKey(entry.spgId, entry.pharmacyId);
    if (entry.value && datesCoveredBy(periodsByPair.get(key) ?? [], [entry.date]).length === 0) {
      const label = names.get(key);
      throw new AppError(
        400,
        label
          ? `${label.spg} tidak ditempatkan di ${label.pharmacy} pada ${entry.date}`
          : "SPG tidak ditempatkan di apotek tersebut",
      );
    }
  }

  const changedSpgIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    const existing = await tx.schedule.findMany({
      where: { date: { in: dates }, OR: pairs.map(({ spgId, pharmacyId }) => ({ spgId, pharmacyId })) },
    });
    const existingByKey = new Map(
      existing.map((schedule) => [`${pairKey(schedule.spgId, schedule.pharmacyId)}:${schedule.date}`, schedule]),
    );

    for (const entry of input.entries) {
      const key = pairKey(entry.spgId, entry.pharmacyId);
      const current = existingByKey.get(`${key}:${entry.date}`);
      const label = { spgName: names.get(key)?.spg, pharmacyName: names.get(key)?.pharmacy, date: entry.date };
      const auditBase = { actor, entity: "Schedule", context };

      if (!entry.value) {
        if (current) {
          await tx.schedule.delete({ where: { id: current.id } });
          await recordAudit(tx, { ...auditBase, action: "schedule.delete", entityId: current.id, before: { ...label, ...toValue(current) } });
          changedSpgIds.add(entry.spgId);
        }
        continue;
      }

      if (current && sameValue(toValue(current), entry.value)) {
        continue;
      }

      const saved = await tx.schedule.upsert({
        where: { spgId_pharmacyId_date: { spgId: entry.spgId, pharmacyId: entry.pharmacyId, date: entry.date } },
        create: { spgId: entry.spgId, pharmacyId: entry.pharmacyId, date: entry.date, ...entry.value },
        update: entry.value,
      });
      await recordAudit(tx, {
        ...auditBase,
        action: "schedule.set",
        entityId: saved.id,
        before: current ? { ...label, ...toValue(current) } : undefined,
        after: { ...label, ...entry.value },
      });
      changedSpgIds.add(entry.spgId);
    }
  });

  for (const spgId of changedSpgIds) {
    await notifyUser(
      spgId,
      "Jadwal diperbarui",
      `Jadwal Anda untuk minggu ${weekStart} sampai ${dates[6]} diperbarui Admin.`,
      "/jadwal-saya",
    );
  }

  return getWeek({ weekStart }, actor);
};

