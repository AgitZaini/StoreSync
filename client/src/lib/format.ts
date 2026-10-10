export function formatCurrency(value: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export function formatCompactCurrency(value: string | number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value));
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number) {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)}%`;
}

// PRD: semua jam memakai WIB, apa pun zona waktu perangkat pengguna.
const APP_TIME_ZONE = "Asia/Jakarta";

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatShortDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: APP_TIME_ZONE }).format(value);
}

export function formatLongDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  }).format(value);
}

export function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

/** 6281234567890 → 0812-3456-7890 */
export function formatPhone(phone: string) {
  const local = phone.startsWith("62") ? `0${phone.slice(2)}` : phone;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

export function getGreeting(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: APP_TIME_ZONE }).format(date),
  );

  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

export function formatOpeningHours(pharmacy: { is24h: boolean; openTime: string | null; closeTime: string | null }) {
  if (pharmacy.is24h) return "Buka 24 jam";
  return pharmacy.openTime && pharmacy.closeTime ? `${pharmacy.openTime}–${pharmacy.closeTime}` : "-";
}

/** Bulan "YYYY-MM" → "Oktober 2026". */
export function formatMonth(month: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: APP_TIME_ZONE }).format(
    new Date(`${month}-01T12:00:00+07:00`),
  );
}

/** Bulan berjalan dalam WIB, format "YYYY-MM". */
export function currentMonth(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", timeZone: APP_TIME_ZONE })
    .format(now)
    .slice(0, 7);
}

export function shiftMonth(month: string, delta: number) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** Jam "HH.mm" WIB dari waktu ISO. */
export function formatTime(value: string | Date) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: APP_TIME_ZONE }).format(
    new Date(value),
  );
}

/** Tanggal bisnis "YYYY-MM-DD" → "Sen, 28 Sep". */
export function formatBusinessDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Intl.DateTimeFormat("id-ID", { ...options, timeZone: APP_TIME_ZONE }).format(new Date(`${date}T12:00:00+07:00`));
}

/** Tanggal bisnis hari ini (WIB), "YYYY-MM-DD". */
export function todayDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: APP_TIME_ZONE }).format(now);
}

export function shiftDate(date: string, days: number) {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

/** Senin pada minggu yang memuat `date`. */
export function mondayOf(date: string) {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return shiftDate(date, -((weekday + 6) % 7));
}

export function formatScheduleValue(value: { isOff: boolean; startTime: string | null; endTime: string | null } | null) {
  if (!value) return "-";
  return value.isOff ? "Libur" : `${value.startTime}–${value.endTime}`;
}

export function formatDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;
}

/** Lama kunjungan dalam menit → "45 mnt" / "1 j 5 mnt". */
export function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} mnt`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} j` : `${hours} j ${rest} mnt`;
}
