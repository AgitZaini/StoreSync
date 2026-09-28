import { AttendanceKind, PharmacyStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { addBusinessDays, businessDate, minutesBetween, mondayOf } from "../../utils/time";
import {
  assertFaceCheckPassed,
  assertPhotoUsable,
  assertWithinRadius,
  lockUser,
  pharmacyForAttendance,
} from "../attendance/attendance-checks";
import type { CreateAttendanceInput } from "../attendance/attendance.schemas";
import { getAttendanceSettings } from "../settings/settings.service";
import { workDayState } from "./leader-workday";

type Tx = Prisma.TransactionClient;

/** Berapa hari ke belakang apotek rencana yang belum diberi alasan diingatkan ke TL. */
const MISSING_REASON_LOOKBACK_DAYS = 28;

const visitAttendanceSelect = {
  id: true,
  serverAt: true,
  latitude: true,
  longitude: true,
  accuracyM: true,
  distanceM: true,
  photoFileId: true,
} satisfies Prisma.AttendanceSelect;

export const visitSelect = {
  id: true,
  businessDate: true,
  checkInAt: true,
  checkOutAt: true,
  durationMin: true,
  pharmacy: { select: { id: true, name: true, address: true, latitude: true, longitude: true, radiusM: true } },
  checkIn: { select: visitAttendanceSelect },
  checkOut: { select: visitAttendanceSelect },
} satisfies Prisma.LeaderVisitSelect;

/** ABS-02: Team Leader bisa absen di semua apotek aktif, bukan hanya apotek timnya. */
const findActivePharmacy = async (pharmacyId: string) => {
  const pharmacy = await prisma.pharmacy.findUnique({ where: { id: pharmacyId }, select: pharmacyForAttendance });

  if (!pharmacy) {
    throw new AppError(404, "Apotek tidak ditemukan");
  }

  if (pharmacy.status !== PharmacyStatus.ACTIVE) {
    throw new AppError(400, "Apotek ini sedang tidak aktif");
  }

  return pharmacy;
};

const findOpenVisit = (tx: Tx, leaderId: string, date: string) =>
  tx.leaderVisit.findFirst({
    where: { leaderId, businessDate: date, checkOutId: null },
    select: { id: true, pharmacyId: true, checkInAt: true, pharmacy: { select: { name: true } } },
  });

/**
 * ABS-02: absen masuk/keluar kunjungan dengan pemeriksaan foto dan lokasi yang sama dengan ABS-01.
 * TL tidak bisa masuk di apotek baru sebelum keluar dari kunjungan yang masih terbuka; lama
 * kunjungan dihitung dari jam server. Absen masuk memulai (atau membuka lagi) sesi kerja hari itu.
 */
export const recordVisitAttendance = async (input: CreateAttendanceInput, actor: AuditActor, context: AuditContext) => {
  const now = new Date();
  const date = businessDate(now);
  const pharmacy = await findActivePharmacy(input.pharmacyId);
  await assertPhotoUsable(actor.id, input.photoFileId);
  assertFaceCheckPassed(input.faceCheck);

  const settings = await getAttendanceSettings();
  const location = assertWithinRadius(pharmacy, input, settings.maxAccuracyM);

  const visit = await prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);
    const open = await findOpenVisit(tx, actor.id, date);

    if (input.kind === AttendanceKind.CHECK_IN && open) {
      throw new AppError(409, `Absen keluar dulu dari ${open.pharmacy.name}`, "VISIT_OPEN");
    }

    if (input.kind === AttendanceKind.CHECK_OUT) {
      if (!open) {
        throw new AppError(409, "Belum ada kunjungan yang terbuka. Absen masuk dulu.");
      }

      if (open.pharmacyId !== pharmacy.id) {
        throw new AppError(409, `Kunjungan yang masih terbuka ada di ${open.pharmacy.name}`, "VISIT_OPEN");
      }
    }

    const attendance = await tx.attendance.create({
      data: {
        userId: actor.id,
        pharmacyId: pharmacy.id,
        kind: input.kind,
        businessDate: date,
        serverAt: now,
        photoFileId: input.photoFileId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyM: location.accuracyM,
        distanceM: location.distanceM,
        faceCheck: input.faceCheck,
        userAgent: context.userAgent,
      },
      select: { id: true },
    });
    const evidence = { distanceM: location.distanceM, accuracyM: location.accuracyM };

    if (input.kind === AttendanceKind.CHECK_IN) {
      const created = await tx.leaderVisit.create({
        data: { leaderId: actor.id, pharmacyId: pharmacy.id, businessDate: date, checkInId: attendance.id, checkInAt: now },
        select: visitSelect,
      });
      const workDay = await tx.leaderWorkDay.findUnique({ where: { leaderId_businessDate: { leaderId: actor.id, businessDate: date } } });

      if (!workDay) {
        await tx.leaderWorkDay.create({ data: { leaderId: actor.id, businessDate: date, startedAt: now } });
      } else if (workDay.endedAt) {
        await tx.leaderWorkDay.update({ where: { id: workDay.id }, data: { endedAt: null } });
      }

      await recordAudit(tx, {
        actor,
        action: "leader_visit.check_in",
        entity: "LeaderVisit",
        entityId: created.id,
        after: {
          pharmacyName: pharmacy.name,
          businessDate: date,
          checkInAt: now,
          ...evidence,
          workDayStarted: !workDay,
          workDayReopened: Boolean(workDay?.endedAt),
        },
        evidenceFileIds: [input.photoFileId],
        context,
      });

      return created;
    }

    const durationMin = minutesBetween(open!.checkInAt, now);
    const updated = await tx.leaderVisit.update({
      where: { id: open!.id },
      data: { checkOutId: attendance.id, checkOutAt: now, durationMin },
      select: visitSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "leader_visit.check_out",
      entity: "LeaderVisit",
      entityId: updated.id,
      after: { pharmacyName: pharmacy.name, businessDate: date, checkOutAt: now, durationMin, ...evidence },
      evidenceFileIds: [input.photoFileId],
      context,
    });

    return updated;
  });

  return { visit };
};

/**
 * Apotek rencana (≤ 4 minggu terakhir, sebelum hari ini) yang tidak dikunjungi dan belum diberi
 * alasan, beserta minggu tertuanya supaya TL bisa langsung membuka evaluasi minggu itu.
 */
const findMissingReasons = async (leaderId: string, today: string) => {
  const items = await prisma.visitPlanItem.findMany({
    where: {
      plan: { leaderId },
      removedAt: null,
      missReason: null,
      date: { lt: today, gte: addBusinessDays(today, -MISSING_REASON_LOOKBACK_DAYS) },
    },
    select: { date: true, pharmacyId: true },
    orderBy: { date: "asc" },
  });

  if (items.length === 0) return { count: 0, weekStart: null };

  const visits = await prisma.leaderVisit.findMany({
    where: { leaderId, businessDate: { in: [...new Set(items.map((item) => item.date))] } },
    select: { businessDate: true, pharmacyId: true },
  });
  const visited = new Set(visits.map((visit) => `${visit.businessDate}:${visit.pharmacyId}`));
  const missing = items.filter((item) => !visited.has(`${item.date}:${item.pharmacyId}`));

  return { count: missing.length, weekStart: missing.length > 0 ? mondayOf(missing[0].date) : null };
};

/** Halaman Absen Kunjungan: sesi kerja, kunjungan hari ini, dan apotek rencana hari ini. */
export const getToday = async (actor: AuditActor) => {
  const now = new Date();
  const date = businessDate(now);
  const [settings, workDay, visits, planItems, lastPing, missingReasons] = await Promise.all([
    getAttendanceSettings(),
    prisma.leaderWorkDay.findUnique({ where: { leaderId_businessDate: { leaderId: actor.id, businessDate: date } } }),
    prisma.leaderVisit.findMany({ where: { leaderId: actor.id, businessDate: date }, select: visitSelect, orderBy: { checkInAt: "asc" } }),
    prisma.visitPlanItem.findMany({
      where: { date, removedAt: null, plan: { leaderId: actor.id } },
      select: { id: true, addedAfterLock: true, pharmacy: { select: pharmacyForAttendance } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.locationPing.findFirst({
      where: { userId: actor.id, businessDate: date },
      orderBy: { recordedAt: "desc" },
      select: { recordedAt: true, accuracyM: true },
    }),
    findMissingReasons(actor.id, date),
  ]);

  return {
    date,
    serverTime: now,
    maxAccuracyM: settings.maxAccuracyM,
    workDay: workDayState(workDay, date, now, settings.leaderWorkEndTime),
    openVisit: visits.find((visit) => !visit.checkOutAt) ?? null,
    visits,
    totalMinutes: visits.reduce((sum, visit) => sum + (visit.durationMin ?? 0), 0),
    plan: planItems.map((item) => ({
      id: item.id,
      addedAfterLock: item.addedAfterLock,
      pharmacy: item.pharmacy,
      visited: visits.some((visit) => visit.pharmacy.id === item.pharmacy.id),
    })),
    lastPing,
    missingReasons,
  };
};

/** "Selesai hari ini": menutup sesi kerja sehingga lokasi live berhenti diterima (ABS-03). */
export const endWorkDay = async (actor: AuditActor, context: AuditContext) => {
  const now = new Date();
  const date = businessDate(now);

  await prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);
    const workDay = await tx.leaderWorkDay.findUnique({ where: { leaderId_businessDate: { leaderId: actor.id, businessDate: date } } });

    if (!workDay) {
      throw new AppError(409, "Hari kerja belum dimulai. Absen masuk di apotek pertama dulu.");
    }

    if (workDay.endedAt) {
      throw new AppError(409, "Hari kerja ini sudah diselesaikan");
    }

    const open = await findOpenVisit(tx, actor.id, date);

    if (open) {
      throw new AppError(409, `Absen keluar dulu dari ${open.pharmacy.name}`, "VISIT_OPEN");
    }

    await tx.leaderWorkDay.update({ where: { id: workDay.id }, data: { endedAt: now } });
    await recordAudit(tx, {
      actor,
      action: "leader_workday.end",
      entity: "LeaderWorkDay",
      entityId: workDay.id,
      before: { businessDate: date, startedAt: workDay.startedAt, endedAt: null },
      after: { businessDate: date, startedAt: workDay.startedAt, endedAt: now },
      context,
    });
  });

  return getToday(actor);
};
