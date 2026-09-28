import { UserRole, UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import type { AuditActor } from "../../utils/audit";
import { prisma } from "../../utils/prisma";
import { businessDate } from "../../utils/time";
import { round1 } from "../attendance/attendance-checks";
import { getAttendanceSettings } from "../settings/settings.service";
import { workDayState } from "../visits/leader-workday";
import { visitSelect } from "../visits/visits.service";
import type { PingInput } from "./location.schemas";

/** Ping lebih rapat dari ini diabaikan (halaman dibuka di dua tab, atau muat ulang berkali-kali). */
const MIN_PING_INTERVAL_MS = 60_000;

const pingSelect = { latitude: true, longitude: true, accuracyM: true, recordedAt: true } as const;

/**
 * ABS-03: titik lokasi live Team Leader, hanya diterima selama sesi kerja hari itu dan memakai jam
 * server. Ping adalah data pelacakan, bukan perubahan data, jadi tidak dicatat di riwayat.
 */
export const recordPing = async (input: PingInput, actor: AuditActor) => {
  const now = new Date();
  const date = businessDate(now);
  const [settings, workDay, last] = await Promise.all([
    getAttendanceSettings(),
    prisma.leaderWorkDay.findUnique({ where: { leaderId_businessDate: { leaderId: actor.id, businessDate: date } } }),
    prisma.locationPing.findFirst({ where: { userId: actor.id, businessDate: date }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true } }),
  ]);
  const state = workDayState(workDay, date, now, settings.leaderWorkEndTime);

  if (state.status !== "ACTIVE") {
    throw new AppError(
      409,
      state.status === "NOT_STARTED"
        ? "Lokasi live mulai dikirim setelah absen masuk pertama hari ini"
        : "Di luar jam kerja, lokasi tidak dikirim",
      "OUTSIDE_WORK_SESSION",
      { status: state.status },
    );
  }

  if (last && now.getTime() - last.recordedAt.getTime() < MIN_PING_INTERVAL_MS) {
    return { stored: false, recordedAt: last.recordedAt, workDay: state };
  }

  const ping = await prisma.locationPing.create({
    data: {
      userId: actor.id,
      businessDate: date,
      recordedAt: now,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracyM: round1(input.accuracyM),
    },
    select: { recordedAt: true },
  });

  return { stored: true, recordedAt: ping.recordedAt, workDay: state };
};

const leaderSelect = { id: true, name: true, phone: true, status: true, ledTeam: { select: { id: true, name: true } } } as const;

/** ABS-03: posisi terakhir dan status kerja setiap Team Leader pada satu tanggal (bawaan: hari ini). */
export const listLeaderPositions = async (date: string | undefined) => {
  const now = new Date();
  const day = date ?? businessDate(now);
  const settings = await getAttendanceSettings();
  const leaders = await prisma.user.findMany({
    where: {
      role: UserRole.TEAM_LEADER,
      OR: [{ status: UserStatus.ACTIVE }, { leaderWorkDays: { some: { businessDate: day } } }],
    },
    select: leaderSelect,
    orderBy: { name: "asc" },
  });
  const leaderIds = leaders.map((leader) => leader.id);

  const [workDays, visits, lastPings, pingCounts] = await Promise.all([
    prisma.leaderWorkDay.findMany({ where: { businessDate: day, leaderId: { in: leaderIds } } }),
    prisma.leaderVisit.findMany({
      where: { businessDate: day, leaderId: { in: leaderIds } },
      select: { leaderId: true, checkInAt: true, checkOutAt: true, durationMin: true, pharmacy: { select: { id: true, name: true } } },
      orderBy: { checkInAt: "asc" },
    }),
    prisma.locationPing.findMany({
      where: { businessDate: day, userId: { in: leaderIds } },
      distinct: ["userId"],
      orderBy: [{ userId: "asc" }, { recordedAt: "desc" }],
      select: { userId: true, ...pingSelect },
    }),
    prisma.locationPing.groupBy({ by: ["userId"], where: { businessDate: day, userId: { in: leaderIds } }, _count: { _all: true } }),
  ]);

  const rows = leaders.map(({ ledTeam, ...leader }) => {
    const leaderVisits = visits.filter((visit) => visit.leaderId === leader.id);
    const open = leaderVisits.find((visit) => !visit.checkOutAt);
    const lastPing = lastPings.find((ping) => ping.userId === leader.id);

    return {
      leader: { ...leader, team: ledTeam },
      workDay: workDayState(workDays.find((workDay) => workDay.leaderId === leader.id) ?? null, day, now, settings.leaderWorkEndTime),
      lastPing: lastPing ? { latitude: lastPing.latitude, longitude: lastPing.longitude, accuracyM: lastPing.accuracyM, recordedAt: lastPing.recordedAt } : null,
      pingCount: pingCounts.find((group) => group.userId === leader.id)?._count._all ?? 0,
      visitCount: leaderVisits.length,
      totalMinutes: leaderVisits.reduce((sum, visit) => sum + (visit.durationMin ?? 0), 0),
      openVisit: open ? { pharmacy: open.pharmacy, checkInAt: open.checkInAt } : null,
    };
  });

  return {
    date: day,
    generatedAt: now,
    workEndTime: settings.leaderWorkEndTime,
    summary: {
      leaders: rows.length,
      active: rows.filter((row) => row.workDay.status === "ACTIVE").length,
      started: rows.filter((row) => row.workDay.status !== "NOT_STARTED").length,
      visits: visits.length,
      openVisits: rows.filter((row) => row.openVisit).length,
    },
    leaders: rows,
  };
};

/** ABS-03: jejak harian satu Team Leader (titik lokasi berurutan) beserta kunjungannya. */
export const getLeaderTrail = async (leaderId: string, date: string | undefined) => {
  const now = new Date();
  const day = date ?? businessDate(now);
  const leader = await prisma.user.findFirst({ where: { id: leaderId, role: UserRole.TEAM_LEADER }, select: leaderSelect });

  if (!leader) {
    throw new AppError(404, "Team Leader tidak ditemukan");
  }

  const [settings, workDay, pings, visits] = await Promise.all([
    getAttendanceSettings(),
    prisma.leaderWorkDay.findUnique({ where: { leaderId_businessDate: { leaderId, businessDate: day } } }),
    prisma.locationPing.findMany({ where: { userId: leaderId, businessDate: day }, select: pingSelect, orderBy: { recordedAt: "asc" } }),
    prisma.leaderVisit.findMany({ where: { leaderId, businessDate: day }, select: visitSelect, orderBy: { checkInAt: "asc" } }),
  ]);
  const { ledTeam, ...rest } = leader;

  return {
    date: day,
    leader: { ...rest, team: ledTeam },
    workDay: workDayState(workDay, day, now, settings.leaderWorkEndTime),
    pings,
    visits,
  };
};
