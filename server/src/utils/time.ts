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

/** Waktu pada tanggal bisnis `date` dan jam `time` ("HH:mm") WIB. */
export const wibDateTime = (date: string, time: string) => new Date(`${date}T${time}:00.000${WIB_OFFSET}`);

/** Hari dalam minggu untuk tanggal bisnis: 0 = Minggu … 6 = Sabtu. */
export const businessWeekday = (date: string) => new Date(`${date}T00:00:00.000Z`).getUTCDay();

/** Tujuh tanggal bisnis mulai Senin `weekStart`. */
export const weekDates = (weekStart: string) => Array.from({ length: 7 }, (_, index) => addBusinessDays(weekStart, index));

/** Senin pada minggu yang memuat tanggal bisnis `date` (minggu kerja Senin–Minggu). */
export const mondayOf = (date: string) => addBusinessDays(date, -((businessWeekday(date) + 6) % 7));

/** Selisih menit dari `from` ke `to`, dibulatkan ke bawah. */
export const minutesBetween = (from: Date, to: Date) => Math.floor((to.getTime() - from.getTime()) / 60_000);
