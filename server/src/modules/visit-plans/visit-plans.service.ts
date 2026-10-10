import { FilePurpose, FileStatus, PharmacyStatus, UserRole, UserStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { addBusinessDays, businessDate, formatShortBusinessDate, mondayOf, startOfBusinessDay, weekDates } from "../../utils/time";
import { lockUser } from "../attendance/attendance-checks";
import { notifyUsersByRole } from "../notifications/notifications.service";
import type { MissReasonInput, SaveVisitPlanInput } from "./visit-plan.schemas";

/** Rencana bisa disiapkan sampai 4 minggu ke depan. */
const MAX_WEEKS_AHEAD = 4;

export type PlanItemStatus = "VISITED" | "MISSED" | "PENDING" | "REMOVED";
type DayTiming = "PAST" | "TODAY" | "FUTURE";

const leaderSelect = { id: true, name: true, status: true, ledTeam: { select: { id: true, name: true } } } satisfies Prisma.UserSelect;

const itemSelect = {
  id: true,
  date: true,
  addedAfterLock: true,
  removedAt: true,
  missReason: true,
  missReasonAt: true,
  createdAt: true,
  pharmacy: { select: { id: true, name: true, address: true, status: true } },
  evidence: { select: { id: true, mimeType: true } },
} satisfies Prisma.VisitPlanItemSelect;

/** KNJ-01: rencana minggu `weekStart` terkunci mulai Senin 00:00 WIB. */
const lockTimeOf = (weekStart: string) => startOfBusinessDay(weekStart);

const toLeader = ({ ledTeam, ...leader }: Prisma.UserGetPayload<{ select: typeof leaderSelect }>) => ({ ...leader, team: ledTeam });

/** TL hanya melihat rencananya sendiri; Super Admin dan Admin memilih Team Leader. */
const resolveLeader = async (actor: AuditActor, leaderId: string | undefined) => {
  if (actor.role === UserRole.TEAM_LEADER) {
    if (leaderId && leaderId !== actor.id) {
      throw new AppError(403, "Anda hanya bisa melihat rencana kunjungan Anda sendiri");
    }
  } else if (!leaderId) {
    throw new AppError(400, "Pilih Team Leader");
  }

  const leader = await prisma.user.findFirst({
    where: { id: leaderId ?? actor.id, role: UserRole.TEAM_LEADER },
    select: leaderSelect,
  });

  if (!leader) {
    throw new AppError(404, "Team Leader tidak ditemukan");
  }

  return leader;
};

const sumMinutes = (visits: Array<{ durationMin: number | null }>) =>
  visits.reduce((sum, visit) => sum + (visit.durationMin ?? 0), 0);

/**
 * KNJ-02: rencana vs kunjungan nyata per hari. Apotek rencana yang lewat tanpa kunjungan
 * menjadi "MISSED" dan wajib diberi alasan; kunjungan di luar rencana ditampilkan terpisah.
 */
const buildWeek = async (leaderId: string, weekStart: string, now: Date) => {
  const today = businessDate(now);
  const dates = weekDates(weekStart);
  const lockedAt = lockTimeOf(weekStart);

  const [plan, visits] = await Promise.all([
    prisma.visitPlan.findUnique({
      where: { leaderId_weekStart: { leaderId, weekStart } },
      select: { id: true, updatedAt: true, items: { select: itemSelect, orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }] } },
    }),
    prisma.leaderVisit.findMany({
      where: { leaderId, businessDate: { in: dates } },
      select: {
        id: true,
        businessDate: true,
        checkInAt: true,
        checkOutAt: true,
        durationMin: true,
        pharmacy: { select: { id: true, name: true, address: true } },
      },
      orderBy: { checkInAt: "asc" },
    }),
  ]);

  const days = dates.map((date) => {
    const timing: DayTiming = date < today ? "PAST" : date === today ? "TODAY" : "FUTURE";
    const dayVisits = visits.filter((visit) => visit.businessDate === date);
    const items = (plan?.items ?? [])
      .filter((item) => item.date === date)
      .map(({ evidence, ...item }) => {
        const itemVisits = dayVisits
          .filter((visit) => visit.pharmacy.id === item.pharmacy.id)
          .map(({ id, checkInAt, checkOutAt, durationMin }) => ({ id, checkInAt, checkOutAt, durationMin }));
        const status: PlanItemStatus = item.removedAt
          ? "REMOVED"
          : itemVisits.length > 0
            ? "VISITED"
            : timing === "PAST"
              ? "MISSED"
              : "PENDING";

        return { ...item, evidence, status, visits: itemVisits, totalMinutes: sumMinutes(itemVisits) };
      });
    const plannedIds = new Set(items.filter((item) => !item.removedAt).map((item) => item.pharmacy.id));
    const unplannedVisits = dayVisits
      .filter((visit) => !plannedIds.has(visit.pharmacy.id))
      .map(({ businessDate: _date, ...visit }) => visit);
    const count = (status: PlanItemStatus) => items.filter((item) => item.status === status).length;

    return {
      date,
      timing,
      items,
      unplannedVisits,
      summary: {
        planned: plannedIds.size,
        visited: count("VISITED"),
        missed: count("MISSED"),
        missingReason: items.filter((item) => item.status === "MISSED" && !item.missReason).length,
        unplanned: unplannedVisits.length,
        visits: dayVisits.length,
        totalMinutes: sumMinutes(dayVisits),
      },
    };
  });

  const total = (key: keyof (typeof days)[number]["summary"]) => days.reduce((sum, day) => sum + day.summary[key], 0);
  const currentWeek = mondayOf(today);

  return {
    weekStart,
    dates,
    today,
    lockedAt,
    isLocked: now >= lockedAt,
    /** Hanya minggu berjalan sampai 4 minggu ke depan yang bisa diubah, dan hanya hari ini ke depan. */
    editable: weekStart >= currentWeek && weekStart <= addBusinessDays(currentWeek, 7 * MAX_WEEKS_AHEAD),
    hasPlan: Boolean(plan && plan.items.length > 0),
    updatedAt: plan?.updatedAt ?? null,
    days,
    summary: {
      planned: total("planned"),
      visited: total("visited"),
      missed: total("missed"),
      missingReason: total("missingReason"),
      unplanned: total("unplanned"),
      visits: total("visits"),
      totalMinutes: total("totalMinutes"),
    },
  };
};

export const getPlanWeek = async (weekStart: string, leaderId: string | undefined, actor: AuditActor) => {
  const leader = await resolveLeader(actor, leaderId);
  return { leader: toLeader(leader), ...(await buildWeek(leader.id, weekStart, new Date())) };
};

/** KNJ-02: ringkasan rencana vs kunjungan semua Team Leader dalam satu minggu. */
export const getWeekSummary = async (weekStart: string) => {
  const now = new Date();
  const leaders = await prisma.user.findMany({
    where: {
      role: UserRole.TEAM_LEADER,
      OR: [{ status: UserStatus.ACTIVE }, { visitPlans: { some: { weekStart } } }],
    },
    select: leaderSelect,
    orderBy: { name: "asc" },
  });

  const rows = [];
  for (const leader of leaders) {
    const week = await buildWeek(leader.id, weekStart, now);
    rows.push({ leader: toLeader(leader), hasPlan: week.hasPlan, isLocked: week.isLocked, summary: week.summary });
  }

  return { weekStart, dates: weekDates(weekStart), leaders: rows };
};

/**
 * KNJ-01: TL menyusun daftar apotek per hari. Sebelum terkunci perubahan bebas; setelah terkunci
 * tetap boleh tetapi apotek tambahan ditandai `addedAfterLock`, apotek yang dihapus disimpan
 * dengan `removedAt`, dan Super Admin diberi tahu. Hari yang sudah lewat tidak bisa diubah.
 */
export const savePlanWeek = async (weekStart: string, input: SaveVisitPlanInput, actor: AuditActor, context: AuditContext) => {
  const now = new Date();
  const today = businessDate(now);
  const currentWeek = mondayOf(today);
  const dates = weekDates(weekStart);

  if (weekStart < currentWeek) {
    throw new AppError(400, "Rencana minggu yang sudah lewat tidak bisa diubah");
  }

  if (weekStart > addBusinessDays(currentWeek, 7 * MAX_WEEKS_AHEAD)) {
    throw new AppError(400, `Rencana hanya bisa disusun sampai ${MAX_WEEKS_AHEAD} minggu ke depan`);
  }

  const seenDates = new Set<string>();
  for (const day of input.days) {
    if (!dates.includes(day.date)) {
      throw new AppError(400, `Tanggal ${day.date} di luar minggu ${weekStart}`);
    }
    if (seenDates.has(day.date)) {
      throw new AppError(400, `Tanggal ${day.date} dikirim lebih dari sekali`);
    }
    if (day.date < today) {
      throw new AppError(400, `Rencana ${day.date} sudah lewat dan tidak bisa diubah`);
    }
    if (new Set(day.pharmacyIds).size !== day.pharmacyIds.length) {
      throw new AppError(400, `Ada apotek ganda pada ${day.date}`);
    }
    seenDates.add(day.date);
  }

  const requestedIds = [...new Set(input.days.flatMap((day) => day.pharmacyIds))];
  const pharmacies = await prisma.pharmacy.findMany({ where: { id: { in: requestedIds } }, select: { id: true, name: true, status: true } });
  const pharmacyNames = new Map(pharmacies.map((pharmacy) => [pharmacy.id, pharmacy.name]));

  if (pharmacies.length !== requestedIds.length) {
    throw new AppError(400, "Ada apotek yang tidak ditemukan");
  }

  const lockedAt = lockTimeOf(weekStart);
  const locked = now >= lockedAt;
  const changedDates: string[] = [];

  await prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);
    const plan = await tx.visitPlan.upsert({
      where: { leaderId_weekStart: { leaderId: actor.id, weekStart } },
      create: { leaderId: actor.id, weekStart, lockedAt },
      update: {},
      select: { id: true },
    });
    const existing = await tx.visitPlanItem.findMany({
      where: { planId: plan.id, date: { in: [...seenDates] } },
      select: { id: true, date: true, pharmacyId: true, removedAt: true, pharmacy: { select: { name: true, status: true } } },
    });

    for (const day of input.days) {
      const current = existing.filter((item) => item.date === day.date);
      const active = current.filter((item) => !item.removedAt);
      const wanted = new Set(day.pharmacyIds);
      const added: string[] = [];
      const removed: string[] = [];

      for (const item of active) {
        if (wanted.has(item.pharmacyId)) continue;
        if (locked) {
          await tx.visitPlanItem.update({ where: { id: item.id }, data: { removedAt: now } });
        } else {
          await tx.visitPlanItem.delete({ where: { id: item.id } });
        }
        removed.push(item.pharmacy.name);
      }

      for (const pharmacyId of day.pharmacyIds) {
        if (active.some((item) => item.pharmacyId === pharmacyId)) continue;

        const pharmacy = pharmacies.find((candidate) => candidate.id === pharmacyId)!;
        if (pharmacy.status !== PharmacyStatus.ACTIVE) {
          throw new AppError(400, `${pharmacy.name} sedang tidak aktif`);
        }

        // Apotek yang tadi dihapus setelah terkunci dikembalikan, bukan dibuat ulang.
        const removedItem = current.find((item) => item.pharmacyId === pharmacyId && item.removedAt);
        if (removedItem) {
          await tx.visitPlanItem.update({ where: { id: removedItem.id }, data: { removedAt: null } });
        } else {
          await tx.visitPlanItem.create({ data: { planId: plan.id, date: day.date, pharmacyId, addedAfterLock: locked } });
        }
        added.push(pharmacy.name);
      }

      if (added.length === 0 && removed.length === 0) continue;

      changedDates.push(day.date);
      await recordAudit(tx, {
        actor,
        action: locked ? "visit_plan.update_after_lock" : "visit_plan.update",
        entity: "VisitPlan",
        entityId: plan.id,
        before: { weekStart, date: day.date, pharmacies: active.map((item) => item.pharmacy.name) },
        after: {
          weekStart,
          date: day.date,
          pharmacies: day.pharmacyIds.map((id) => pharmacyNames.get(id)),
          added,
          removed,
          afterLock: locked,
        },
        context,
      });
    }

    if (changedDates.length > 0) {
      await tx.visitPlan.update({ where: { id: plan.id }, data: { updatedAt: now } });
    }
  });

  if (locked && changedDates.length > 0) {
    const leader = await prisma.user.findUniqueOrThrow({ where: { id: actor.id }, select: { name: true } });
    await notifyUsersByRole(
      [UserRole.SUPER_ADMIN],
      "Rencana kunjungan diubah",
      `${leader.name} mengubah rencana kunjungan ${changedDates.map(formatShortBusinessDate).join(", ")} setelah rencana terkunci.`,
      `/evaluasi-kunjungan?leader=${actor.id}&minggu=${weekStart}`,
    );
  }

  return getPlanWeek(weekStart, undefined, actor);
};

/** KNJ-02: alasan wajib (dan bukti opsional) untuk apotek rencana yang tidak dikunjungi. */
export const saveMissReason = async (itemId: string, input: MissReasonInput, actor: AuditActor, context: AuditContext) => {
  const now = new Date();
  const today = businessDate(now);
  const item = await prisma.visitPlanItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      date: true,
      pharmacyId: true,
      removedAt: true,
      missReason: true,
      evidenceFileId: true,
      plan: { select: { leaderId: true, weekStart: true } },
      pharmacy: { select: { name: true } },
    },
  });

  if (!item || item.plan.leaderId !== actor.id) {
    throw new AppError(404, "Rencana kunjungan tidak ditemukan");
  }

  if (item.removedAt) {
    throw new AppError(409, "Apotek ini sudah dihapus dari rencana");
  }

  if (item.date > today) {
    throw new AppError(409, "Alasan bisa diisi mulai hari kunjungan");
  }

  const visited = await prisma.leaderVisit.count({ where: { leaderId: actor.id, pharmacyId: item.pharmacyId, businessDate: item.date } });

  if (visited > 0) {
    throw new AppError(409, `${item.pharmacy.name} sudah dikunjungi pada hari itu`);
  }

  if (input.evidenceFileId) {
    const file = await prisma.fileObject.findUnique({
      where: { id: input.evidenceFileId },
      select: { uploadedById: true, purpose: true, status: true, visitPlanItem: { select: { id: true } } },
    });

    if (!file || file.uploadedById !== actor.id || file.purpose !== FilePurpose.VISIT_EVIDENCE) {
      throw new AppError(400, "Bukti tidak valid");
    }

    if (file.status !== FileStatus.UPLOADED) {
      throw new AppError(400, "Bukti belum selesai diunggah");
    }

    if (file.visitPlanItem && file.visitPlanItem.id !== item.id) {
      throw new AppError(409, "Bukti ini sudah dipakai untuk apotek lain");
    }
  }

  const evidenceFileId = input.evidenceFileId === undefined ? item.evidenceFileId : input.evidenceFileId;

  await prisma.$transaction(async (tx) => {
    await tx.visitPlanItem.update({
      where: { id: item.id },
      data: { missReason: input.reason, missReasonAt: now, evidenceFileId },
    });
    await recordAudit(tx, {
      actor,
      action: "visit_plan.miss_reason",
      entity: "VisitPlanItem",
      entityId: item.id,
      before: item.missReason ? { pharmacyName: item.pharmacy.name, date: item.date, missReason: item.missReason, hasEvidence: Boolean(item.evidenceFileId) } : undefined,
      after: { pharmacyName: item.pharmacy.name, date: item.date, missReason: input.reason, hasEvidence: Boolean(evidenceFileId) },
      evidenceFileIds: evidenceFileId ? [evidenceFileId] : [],
      context,
    });
  });

  return getPlanWeek(item.plan.weekStart, undefined, actor);
};
