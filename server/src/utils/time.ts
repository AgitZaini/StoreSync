/** Semua tanggal bisnis memakai WIB (UTC+7, tanpa daylight saving). */
export const APP_TIME_ZONE = "Asia/Jakarta";
const WIB_OFFSET = "+07:00";

const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Tanggal bisnis (YYYY-MM-DD) di WIB untuk sebuah waktu; bawaan: sekarang. */
export const businessDate = (at: Date = new Date()) => businessDateFormatter.format(at);

/** Waktu 00:00 WIB pada tanggal bisnis `date` (YYYY-MM-DD). */
export const startOfBusinessDay = (date: string) => new Date(`${date}T00:00:00.000${WIB_OFFSET}`);

/** Menggeser tanggal bisnis `date` (YYYY-MM-DD) sebanyak `days` hari. */
export const addBusinessDays = (date: string, days: number) => {
  const shifted = new Date(`${date}T00:00:00.000Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
};
