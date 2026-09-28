import { minutesBetween, wibDateTime } from "../../utils/time";

/**
 * Status kehadiran satu SPG di satu apotek pada satu hari (ABS-04).
 * Dihitung saat dibaca, jadi tidak butuh job terjadwal.
 */
export type AttendanceStatus =
  | "OFF" // libur sesuai jadwal
  | "UPCOMING" // jam masuk belum tiba
  | "NOT_CHECKED_IN" // jam masuk sudah lewat, belum absen, jadwal belum selesai
  | "ON_TIME"
  | "LATE"
  | "ABSENT" // jadwal selesai tanpa absen masuk
  | "UNSCHEDULED"; // absen tanpa jadwal (atau di hari libur)

type ScheduleValue = { isOff: boolean; startTime: string | null; endTime: string | null };

export const evaluateAttendanceDay = ({
  date,
  now,
  schedule,
  checkInAt,
  lateToleranceMinutes,
}: {
  date: string;
  now: Date;
  schedule: ScheduleValue | null;
  checkInAt: Date | null;
  lateToleranceMinutes: number;
}): { status: AttendanceStatus | null; lateMinutes: number } => {
  if (!schedule || schedule.isOff || !schedule.startTime || !schedule.endTime) {
    if (checkInAt) return { status: "UNSCHEDULED", lateMinutes: 0 };
    return { status: schedule?.isOff ? "OFF" : null, lateMinutes: 0 };
  }

  const startAt = wibDateTime(date, schedule.startTime);
  // Shift malam (mis. 22:00–06:00) selesai keesokan harinya.
  const endAt = new Date(
    wibDateTime(date, schedule.endTime).getTime() + (schedule.endTime <= schedule.startTime ? 24 * 60 * 60 * 1000 : 0),
  );

  if (checkInAt) {
    const lateMinutes = Math.max(0, minutesBetween(startAt, checkInAt));
    return { status: lateMinutes > lateToleranceMinutes ? "LATE" : "ON_TIME", lateMinutes };
  }

  if (now < startAt) return { status: "UPCOMING", lateMinutes: 0 };
  if (now >= endAt) return { status: "ABSENT", lateMinutes: 0 };
  return { status: "NOT_CHECKED_IN", lateMinutes: minutesBetween(startAt, now) };
};
