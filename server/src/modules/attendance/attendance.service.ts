import { AttendanceExceptionStatus, AttendanceKind, FilePurpose, FileStatus, PharmacyStatus, Prisma, UserRole } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { distanceInMeters } from "../../utils/geo";
import { prisma } from "../../utils/prisma";
import { scopeFor, spgIdFilter } from "../../utils/scope";
import { businessDate } from "../../utils/time";
import { notifyUser, notifyUsersByRole } from "../notifications/notifications.service";
import { getAttendanceSettings } from "../settings/settings.service";
import { evaluateAttendanceDay } from "./attendance-status";
import type { AttendanceStatus } from "./attendance-status";
import type {
  CreateAttendanceExceptionInput,
  CreateAttendanceInput,
  HistoryQuery,
  SaveNoteInput,
} from "./attendance.schemas";

type Tx = Prisma.TransactionClient;

const KIND_LABEL: Record<AttendanceKind, string> = { CHECK_IN: "absen masuk", CHECK_OUT: "absen pulang" };

const attendanceView = {
  id: true,
  kind: true,
  serverAt: true,
  latitude: true,
  longitude: true,
  accuracyM: true,
  distanceM: true,
  photoFileId: true,
  exceptionId: true,
} satisfies Prisma.AttendanceSelect;

const pharmacyForAttendance = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  radiusM: true,
  is24h: true,
  openTime: true,
  closeTime: true,
  status: true,
} satisfies Prisma.PharmacySelect;

const round1 = (value: number) => Math.round(value * 10) / 10;

/** AB-03: SPG hanya bisa absen di apotek tempat ia ditempatkan saat ini. */
const findAssignedPharmacy = async (spgId: string, pharmacyId: string) => {
  const placement = await prisma.placement.findFirst({
    where: { spgId, pharmacyId, endedAt: null },
    select: { pharmacy: { select: pharmacyForAttendance } },
  });

  if (!placement) {
    throw new AppError(403, "Anda tidak ditugaskan di apotek ini");
  }

  if (placement.pharmacy.status !== PharmacyStatus.ACTIVE) {
    throw new AppError(400, "Apotek ini sedang tidak aktif");
  }

  return placement.pharmacy;
};

/** Foto harus hasil unggahan pengguna ini sendiri, untuk absen, dan belum pernah dipakai. */
const assertPhotoUsable = async (userId: string, photoFileId: string) => {
  const file = await prisma.fileObject.findUnique({
    where: { id: photoFileId },
    select: { uploadedById: true, purpose: true, status: true, attendance: { select: { id: true } }, attendanceException: { select: { id: true } } },
  });

  if (!file || file.uploadedById !== userId || file.purpose !== FilePurpose.ATTENDANCE_PHOTO) {
    throw new AppError(400, "Foto absen tidak valid");
  }

  if (file.status !== FileStatus.UPLOADED) {
    throw new AppError(400, "Foto absen belum selesai diunggah");
  }

  if (file.attendance || file.attendanceException) {
    throw new AppError(409, "Foto ini sudah dipakai. Ambil foto baru.");
  }
};

const lockUser = (tx: Tx, userId: string) => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;

/**
 * Urutan absen dalam sehari (ABS-01): pulang hanya setelah masuk di apotek yang sama, dan
 * SPG tidak bisa masuk di apotek lain sebelum pulang dari apotek sebelumnya.
 * Pengecualian yang masih menunggu dianggap seperti absennya sudah ada.
 */
const assertSequence = async (
  tx: Tx,
  { userId, pharmacyId, date, kind }: { userId: string; pharmacyId: string; date: string; kind: AttendanceKind },
) => {
  const [records, pending] = await Promise.all([
    tx.attendance.findMany({
      where: { userId, businessDate: date },
      select: { kind: true, pharmacyId: true, pharmacy: { select: { name: true } } },
    }),
    tx.attendanceException.findMany({
      where: { userId, businessDate: date, status: AttendanceExceptionStatus.PENDING },
      select: { kind: true, pharmacyId: true, pharmacy: { select: { name: true } } },
    }),
  ]);
  const events = [...records, ...pending];
  const has = (targetKind: AttendanceKind, targetPharmacyId = pharmacyId) =>
    events.some((event) => event.kind === targetKind && event.pharmacyId === targetPharmacyId);

  if (kind === AttendanceKind.CHECK_IN) {
    if (has(AttendanceKind.CHECK_IN)) {
      throw new AppError(409, "Anda sudah absen masuk di apotek ini hari ini");
    }

    const open = events.find(
      (event) =>
        event.kind === AttendanceKind.CHECK_IN &&
        event.pharmacyId !== pharmacyId &&
        !has(AttendanceKind.CHECK_OUT, event.pharmacyId),
    );

    if (open) {
      throw new AppError(409, `Absen pulang dulu dari ${open.pharmacy.name}`);
    }
    return;
  }

  if (!has(AttendanceKind.CHECK_IN)) {
    throw new AppError(409, "Absen masuk dulu sebelum absen pulang");
  }

  if (has(AttendanceKind.CHECK_OUT)) {
    throw new AppError(409, "Anda sudah absen pulang dari apotek ini hari ini");
  }
};

const measureLocation = (
  pharmacy: { latitude: number; longitude: number },
  input: { latitude: number; longitude: number },
) => round1(distanceInMeters(input, pharmacy));

/** ABS-01: absen masuk/pulang dengan foto langsung + lokasi dalam radius apotek, memakai jam server. */
export const createAttendance = async (input: CreateAttendanceInput, actor: AuditActor, context: AuditContext) => {
  const now = new Date();
  const date = businessDate(now);
  const pharmacy = await findAssignedPharmacy(actor.id, input.pharmacyId);
  await assertPhotoUsable(actor.id, input.photoFileId);

  if (!input.faceCheck.passed) {
    throw new AppError(400, "Verifikasi wajah belum berhasil. Ulangi foto.", "FACE_CHECK_FAILED");
  }

  const settings = await getAttendanceSettings();
  const distanceM = measureLocation(pharmacy, input);
  const location = { distanceM, radiusM: pharmacy.radiusM, accuracyM: round1(input.accuracyM), maxAccuracyM: settings.maxAccuracyM };

  if (input.accuracyM > settings.maxAccuracyM) {
    throw new AppError(
      422,
      `Sinyal GPS belum akurat (±${Math.round(input.accuracyM)} m). Tunggu sebentar di dekat pintu atau jendela, lalu coba lagi.`,
      "LOW_ACCURACY",
      location,
    );
  }

  if (distanceM > pharmacy.radiusM) {
    throw new AppError(
      422,
      `Anda berada ${Math.round(distanceM)} m dari ${pharmacy.name}. Absen hanya bisa dalam radius ${pharmacy.radiusM} m.`,
      "OUTSIDE_RADIUS",
      location,
    );
  }

  const attendance = await prisma.$transaction(async (tx) => {
    // Kunci per pengguna supaya ketukan ganda tidak menghasilkan dua absen.
    await lockUser(tx, actor.id);
    await assertSequence(tx, { userId: actor.id, pharmacyId: pharmacy.id, date, kind: input.kind });

    const created = await tx.attendance.create({
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
        distanceM,
        faceCheck: input.faceCheck,
        userAgent: context.userAgent,
      },
      select: attendanceView,
    });

    await recordAudit(tx, {
      actor,
      action: input.kind === AttendanceKind.CHECK_IN ? "attendance.check_in" : "attendance.check_out",
      entity: "Attendance",
      entityId: created.id,
      after: { pharmacyName: pharmacy.name, businessDate: date, serverAt: now, distanceM, accuracyM: location.accuracyM },
      evidenceFileIds: [input.photoFileId],
      context,
    });

    return created;
  });

  return { attendance, pharmacy: { id: pharmacy.id, name: pharmacy.name } };
};

/** Status absen hari ini untuk SPG di setiap apotek tugasnya (halaman Absen). */
export const getToday = async (actor: AuditActor) => {
  const now = new Date();
  const date = businessDate(now);
  const [placements, schedules, records, pending, settings] = await Promise.all([
    prisma.placement.findMany({
      where: { spgId: actor.id, endedAt: null, pharmacy: { status: PharmacyStatus.ACTIVE } },
      select: { pharmacy: { select: pharmacyForAttendance } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.schedule.findMany({ where: { spgId: actor.id, date } }),
    prisma.attendance.findMany({ where: { userId: actor.id, businessDate: date }, select: { ...attendanceView, pharmacyId: true } }),
    prisma.attendanceException.findMany({
      where: { userId: actor.id, businessDate: date, status: AttendanceExceptionStatus.PENDING },
      select: { id: true, kind: true, pharmacyId: true, requestedAt: true, reason: true },
    }),
    getAttendanceSettings(),
  ]);

  const pharmacies = placements.map(({ pharmacy }) => {
    const schedule = schedules.find((item) => item.pharmacyId === pharmacy.id) ?? null;
    const checkIn = records.find((record) => record.pharmacyId === pharmacy.id && record.kind === AttendanceKind.CHECK_IN) ?? null;
    const checkOut = records.find((record) => record.pharmacyId === pharmacy.id && record.kind === AttendanceKind.CHECK_OUT) ?? null;
    const pendingHere = pending.filter((exception) => exception.pharmacyId === pharmacy.id);
    const day = evaluateAttendanceDay({
      date,
      now,
      schedule,
      checkInAt: checkIn?.serverAt ?? null,
      lateToleranceMinutes: settings.lateToleranceMinutes,
    });
    const pendingKinds = new Set(pendingHere.map((exception) => exception.kind));
    const checkedIn = Boolean(checkIn) || pendingKinds.has(AttendanceKind.CHECK_IN);
    const checkedOut = Boolean(checkOut) || pendingKinds.has(AttendanceKind.CHECK_OUT);

    return {
      pharmacy,
      schedule: schedule ? { isOff: schedule.isOff, startTime: schedule.startTime, endTime: schedule.endTime } : null,
      checkIn,
      checkOut,
      pendingExceptions: pendingHere,
      status: day.status,
      lateMinutes: day.lateMinutes,
      nextAction: !checkedIn ? AttendanceKind.CHECK_IN : !checkedOut ? AttendanceKind.CHECK_OUT : null,
    };
  });

  const openPharmacy = pharmacies.find(
    (item) =>
      (item.checkIn || item.pendingExceptions.some((exception) => exception.kind === AttendanceKind.CHECK_IN)) &&
      !item.checkOut &&
      !item.pendingExceptions.some((exception) => exception.kind === AttendanceKind.CHECK_OUT),
  );

  return {
    date,
    serverTime: now,
    maxAccuracyM: settings.maxAccuracyM,
    openPharmacyId: openPharmacy?.pharmacy.id ?? null,
    pharmacies,
  };
};

/** Riwayat absen dalam rentang tanggal; SPG miliknya, TL timnya, Admin/SA semua. */
export const listHistory = async (query: HistoryQuery, actor: AuditActor) => {
  const scope = await scopeFor(actor);

  return prisma.attendance.findMany({
    where: {
      AND: [
        { userId: spgIdFilter(scope) },
        { userId: query.spgId, businessDate: { gte: query.from, lte: query.to } },
      ],
    },
    select: {
      ...attendanceView,
      businessDate: true,
      user: { select: { id: true, name: true } },
      pharmacy: { select: { id: true, name: true } },
    },
    orderBy: { serverAt: "desc" },
    take: 500,
  });
};

const STATUS_ORDER: Record<AttendanceStatus, number> = {
  NOT_CHECKED_IN: 0,
  ABSENT: 1,
  LATE: 2,
  UNSCHEDULED: 3,
  ON_TIME: 4,
  UPCOMING: 5,
  OFF: 6,
};

/** ABS-04: jadwal vs absen per SPG per apotek pada satu tanggal (bawaan: hari ini, WIB). */
export const getMonitor = async (date: string | undefined, actor: AuditActor) => {
  const now = new Date();
  const day = date ?? businessDate(now);
  const scope = await scopeFor(actor);
  const spgFilter = spgIdFilter(scope);

  const [schedules, records, notes, pending, settings] = await Promise.all([
    prisma.schedule.findMany({
      where: { date: day, spgId: spgFilter },
      select: {
        spgId: true,
        pharmacyId: true,
        isOff: true,
        startTime: true,
        endTime: true,
        spg: { select: { id: true, name: true, team: { select: { id: true, name: true } } } },
        pharmacy: { select: { id: true, name: true } },
      },
    }),
    prisma.attendance.findMany({
      where: { businessDate: day, userId: spgFilter, user: { role: UserRole.SPG } },
      select: {
        ...attendanceView,
        userId: true,
        pharmacyId: true,
        user: { select: { id: true, name: true, team: { select: { id: true, name: true } } } },
        pharmacy: { select: { id: true, name: true } },
      },
      orderBy: { serverAt: "asc" },
    }),
    prisma.attendanceNote.findMany({ where: { date: day, spgId: spgFilter } }),
    prisma.attendanceException.groupBy({
      by: ["userId", "pharmacyId"],
      where: { businessDate: day, userId: spgFilter, status: AttendanceExceptionStatus.PENDING },
      _count: { _all: true },
    }),
    getAttendanceSettings(),
  ]);

  const pairs = new Map<string, { spg: (typeof schedules)[number]["spg"]; pharmacy: { id: string; name: string } }>();
  schedules.forEach((schedule) => pairs.set(`${schedule.spgId}:${schedule.pharmacyId}`, schedule));
  records.forEach((record) => {
    const key = `${record.userId}:${record.pharmacyId}`;
    if (!pairs.has(key)) pairs.set(key, { spg: record.user, pharmacy: record.pharmacy });
  });

  const rows = [...pairs.entries()].map(([key, { spg, pharmacy }]) => {
    const schedule = schedules.find((item) => `${item.spgId}:${item.pharmacyId}` === key) ?? null;
    const findRecord = (kind: AttendanceKind) =>
      records.find((record) => `${record.userId}:${record.pharmacyId}` === key && record.kind === kind) ?? null;
    const checkIn = findRecord(AttendanceKind.CHECK_IN);
    const checkOut = findRecord(AttendanceKind.CHECK_OUT);
    const evaluation = evaluateAttendanceDay({
      date: day,
      now,
      schedule,
      checkInAt: checkIn?.serverAt ?? null,
      lateToleranceMinutes: settings.lateToleranceMinutes,
    });
    const strip = (record: typeof checkIn) =>
      record
        ? {
            id: record.id,
            serverAt: record.serverAt,
            latitude: record.latitude,
            longitude: record.longitude,
            accuracyM: record.accuracyM,
            distanceM: record.distanceM,
            photoFileId: record.photoFileId,
            viaException: Boolean(record.exceptionId),
          }
        : null;

    return {
      spg,
      pharmacy,
      schedule: schedule ? { isOff: schedule.isOff, startTime: schedule.startTime, endTime: schedule.endTime } : null,
      status: evaluation.status ?? ("UNSCHEDULED" as AttendanceStatus),
      lateMinutes: evaluation.lateMinutes,
      checkIn: strip(checkIn),
      checkOut: strip(checkOut),
      note: notes.find((note) => note.spgId === spg.id && note.pharmacyId === pharmacy.id)?.note ?? null,
      pendingExceptions:
        pending.find((group) => group.userId === spg.id && group.pharmacyId === pharmacy.id)?._count._all ?? 0,
    };
  });

  rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.spg.name.localeCompare(b.spg.name));

  const count = (status: AttendanceStatus) => rows.filter((row) => row.status === status).length;

  return {
    date: day,
    generatedAt: now,
    lateToleranceMinutes: settings.lateToleranceMinutes,
    summary: {
      scheduled: rows.filter((row) => row.schedule && !row.schedule.isOff).length,
      onTime: count("ON_TIME"),
      late: count("LATE"),
      notCheckedIn: count("NOT_CHECKED_IN"),
      absent: count("ABSENT"),
      upcoming: count("UPCOMING"),
      off: count("OFF"),
      unscheduled: count("UNSCHEDULED"),
      pendingExceptions: rows.reduce((sum, row) => sum + row.pendingExceptions, 0),
    },
    rows,
  };
};

/** ABS-04: Admin mencatat alasan telat/tidak masuk; tidak ada potongan otomatis (AB-04). */
export const saveNote = async (input: SaveNoteInput, actor: AuditActor, context: AuditContext) => {
  const where = { spgId_pharmacyId_date: { spgId: input.spgId, pharmacyId: input.pharmacyId, date: input.date } };
  const existing = await prisma.attendanceNote.findUnique({ where });

  if (!input.note && !existing) {
    return null;
  }

  return prisma.$transaction(async (tx) => {
    const saved = input.note
      ? await tx.attendanceNote.upsert({
          where,
          create: { ...input, updatedById: actor.id },
          update: { note: input.note, updatedById: actor.id },
        })
      : null;

    if (!input.note && existing) {
      await tx.attendanceNote.delete({ where });
    }

    await recordAudit(tx, {
      actor,
      action: "attendance.note",
      entity: "AttendanceNote",
      entityId: saved?.id ?? existing?.id,
      before: existing ? { date: existing.date, note: existing.note } : undefined,
      after: saved ? { date: saved.date, note: saved.note } : undefined,
      context,
    });

    return saved;
  });
};

// ——— Pengecualian absen (GPS dalam gedung gagal, atau verifikasi wajah tidak bisa berjalan) ———

const exceptionSelect = {
  id: true,
  kind: true,
  businessDate: true,
  requestedAt: true,
  photoFileId: true,
  latitude: true,
  longitude: true,
  accuracyM: true,
  distanceM: true,
  faceCheck: true,
  reason: true,
  status: true,
  reviewedAt: true,
  reviewNote: true,
  user: { select: { id: true, name: true, phone: true } },
  pharmacy: { select: { id: true, name: true, radiusM: true } },
} satisfies Prisma.AttendanceExceptionSelect;

export const createException = async (
  input: CreateAttendanceExceptionInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  const now = new Date();
  const date = businessDate(now);
  const pharmacy = await findAssignedPharmacy(actor.id, input.pharmacyId);
  await assertPhotoUsable(actor.id, input.photoFileId);
  const distanceM = measureLocation(pharmacy, input);

  const exception = await prisma.$transaction(async (tx) => {
    await lockUser(tx, actor.id);
    await assertSequence(tx, { userId: actor.id, pharmacyId: pharmacy.id, date, kind: input.kind });

    const created = await tx.attendanceException.create({
      data: {
        userId: actor.id,
        pharmacyId: pharmacy.id,
        kind: input.kind,
        businessDate: date,
        requestedAt: now,
        photoFileId: input.photoFileId,
        latitude: input.latitude,
        longitude: input.longitude,
        accuracyM: round1(input.accuracyM),
        distanceM,
        faceCheck: input.faceCheck,
        reason: input.reason,
      },
      select: exceptionSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "attendance_exception.create",
      entity: "AttendanceException",
      entityId: created.id,
      after: { pharmacyName: pharmacy.name, kind: input.kind, distanceM, accuracyM: created.accuracyM, reason: input.reason },
      evidenceFileIds: [input.photoFileId],
      context,
    });

    return created;
  });

  await notifyUsersByRole(
    [UserRole.ADMIN],
    "Pengecualian absen",
    `${exception.user.name} mengajukan ${KIND_LABEL[input.kind]} di ${pharmacy.name} (${Math.round(distanceM)} m): ${input.reason}`,
    "/pemantauan-absen?tab=pengecualian",
  );

  return exception;
};

export const listExceptions = async (status: AttendanceExceptionStatus | undefined, actor: AuditActor) => {
  const scope = await scopeFor(actor);

  return prisma.attendanceException.findMany({
    where: { userId: spgIdFilter(scope), status },
    select: exceptionSelect,
    orderBy: [{ status: "asc" }, { requestedAt: "desc" }],
    take: 200,
  });
};

const lockPendingException = async (tx: Tx, exceptionId: string) => {
  await tx.$queryRaw`SELECT id FROM "AttendanceException" WHERE id = ${exceptionId} FOR UPDATE`;
  const exception = await tx.attendanceException.findUnique({ where: { id: exceptionId }, include: { pharmacy: { select: { name: true } } } });

  if (!exception) {
    throw new AppError(404, "Pengajuan tidak ditemukan");
  }

  if (exception.status !== AttendanceExceptionStatus.PENDING) {
    throw new AppError(409, "Pengajuan ini sudah diproses");
  }

  return exception;
};

/** Disetujui: absen tercatat dengan jam saat SPG mencoba absen, bukan jam persetujuan. */
export const approveException = async (
  exceptionId: string,
  note: string | undefined,
  actor: AuditActor,
  context: AuditContext,
) => {
  const exception = await prisma.$transaction(async (tx) => {
    const pending = await lockPendingException(tx, exceptionId);
    await lockUser(tx, pending.userId);

    const sameDay = await tx.attendance.findMany({
      where: { userId: pending.userId, pharmacyId: pending.pharmacyId, businessDate: pending.businessDate },
      select: { kind: true },
    });

    if (sameDay.some((record) => record.kind === pending.kind)) {
      throw new AppError(409, `SPG sudah punya ${KIND_LABEL[pending.kind]} di apotek ini pada hari itu. Tolak pengajuan ini.`);
    }

    if (pending.kind === AttendanceKind.CHECK_OUT && !sameDay.some((record) => record.kind === AttendanceKind.CHECK_IN)) {
      throw new AppError(409, "Setujui pengecualian absen masuk SPG ini dulu");
    }

    const attendance = await tx.attendance.create({
      data: {
        userId: pending.userId,
        pharmacyId: pending.pharmacyId,
        kind: pending.kind,
        businessDate: pending.businessDate,
        serverAt: pending.requestedAt,
        photoFileId: pending.photoFileId,
        latitude: pending.latitude,
        longitude: pending.longitude,
        accuracyM: pending.accuracyM,
        distanceM: pending.distanceM,
        faceCheck: pending.faceCheck ?? undefined,
        exceptionId: pending.id,
      },
      select: { id: true },
    });
    const updated = await tx.attendanceException.update({
      where: { id: pending.id },
      data: { status: AttendanceExceptionStatus.APPROVED, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note },
      select: exceptionSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "attendance_exception.approve",
      entity: "AttendanceException",
      entityId: pending.id,
      before: { status: AttendanceExceptionStatus.PENDING },
      after: { status: AttendanceExceptionStatus.APPROVED, attendanceId: attendance.id, reviewNote: note },
      evidenceFileIds: [pending.photoFileId],
      context,
    });

    return updated;
  });

  await notifyUser(
    exception.user.id,
    "Pengecualian absen disetujui",
    `${KIND_LABEL[exception.kind]} Anda di ${exception.pharmacy.name} sudah dicatat Admin.`,
    "/absen",
  );

  return exception;
};

export const rejectException = async (exceptionId: string, note: string, actor: AuditActor, context: AuditContext) => {
  const exception = await prisma.$transaction(async (tx) => {
    const pending = await lockPendingException(tx, exceptionId);
    const updated = await tx.attendanceException.update({
      where: { id: pending.id },
      data: { status: AttendanceExceptionStatus.REJECTED, reviewedById: actor.id, reviewedAt: new Date(), reviewNote: note },
      select: exceptionSelect,
    });

    await recordAudit(tx, {
      actor,
      action: "attendance_exception.reject",
      entity: "AttendanceException",
      entityId: pending.id,
      before: { status: AttendanceExceptionStatus.PENDING },
      after: { status: AttendanceExceptionStatus.REJECTED, reviewNote: note },
      context,
    });

    return updated;
  });

  await notifyUser(
    exception.user.id,
    "Pengecualian absen ditolak",
    `${KIND_LABEL[exception.kind]} di ${exception.pharmacy.name} ditolak: ${note}`,
    "/absen",
  );

  return exception;
};
