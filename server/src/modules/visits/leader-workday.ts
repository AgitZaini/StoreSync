import { wibDateTime } from "../../utils/time";

/**
 * Sesi kerja harian Team Leader (ABS-03). Dimulai saat absen masuk pertama hari itu dan
 * selesai saat TL menekan "Selesai hari ini" atau batas jam kerja (Pengaturan) lewat.
 * Dihitung saat dibaca, jadi tidak butuh job terjadwal.
 */
export type WorkDayStatus = "NOT_STARTED" | "ACTIVE" | "ENDED";

export const workDayState = (
  workDay: { startedAt: Date; endedAt: Date | null } | null,
  date: string,
  now: Date,
  workEndTime: string,
) => {
  const endsAt = wibDateTime(date, workEndTime);
  const status: WorkDayStatus = !workDay ? "NOT_STARTED" : workDay.endedAt || now >= endsAt ? "ENDED" : "ACTIVE";

  return {
    status,
    startedAt: workDay?.startedAt ?? null,
    endedAt: workDay?.endedAt ?? null,
    /** Batas jam kerja hari itu; lokasi live berhenti diterima setelah jam ini. */
    endsAt,
  };
};
