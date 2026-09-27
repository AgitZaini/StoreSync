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
