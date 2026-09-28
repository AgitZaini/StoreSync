import { Pill } from "../../components/ui";
import type { PillTone } from "../../components/ui";
import type { AttendanceStatus } from "../../types/attendance";

const statusMeta: Record<AttendanceStatus, { label: string; tone: PillTone }> = {
  ON_TIME: { label: "Tepat waktu", tone: "green" },
  LATE: { label: "Telat", tone: "orange" },
  NOT_CHECKED_IN: { label: "Belum absen", tone: "red" },
  ABSENT: { label: "Tidak masuk", tone: "red" },
  UPCOMING: { label: "Belum mulai", tone: "gray" },
  OFF: { label: "Libur", tone: "violet" },
  UNSCHEDULED: { label: "Tanpa jadwal", tone: "blue" },
};

export function AttendanceStatusPill({ status, lateMinutes = 0 }: { status: AttendanceStatus; lateMinutes?: number }) {
  const meta = statusMeta[status];
  const withMinutes = (status === "LATE" || status === "NOT_CHECKED_IN") && lateMinutes > 0;

  return <Pill tone={meta.tone}>{withMinutes ? `${meta.label} ${lateMinutes} mnt` : meta.label}</Pill>;
}
