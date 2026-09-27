import { roleLabels } from "../../lib/roles";
import { formatCurrency, formatDateTime, formatMonth, formatPhone } from "../../lib/format";
import type { UserRole } from "../../types/auth";

export const actionLabels: Record<string, string> = {
  "auth.login": "Masuk ke aplikasi",
  "auth.change_password": "Mengganti kata sandi",
  "user.create": "Membuat akun",
  "user.update": "Mengubah akun",
  "user.update_status": "Mengubah status akun",
  "user.reset_password": "Mereset kata sandi",
  "user.update_team": "Memindahkan tim SPG",
  "team.create": "Membuat tim",
  "team.update": "Mengubah tim",
  "pharmacy.create": "Mendaftarkan apotek",
  "pharmacy.update": "Mengubah data apotek",
  "pharmacy.update_status": "Mengubah status apotek",
  "placement.create": "Menempatkan SPG",
  "placement.end": "Melepas penempatan SPG",
  "product.create": "Menambah produk",
  "product.update": "Mengubah produk",
  "target.set": "Mengatur target omzet",
  "target.delete": "Menghapus target omzet",
  "setting.update_leave_quota": "Mengubah jatah cuti Team Leader",
  "setting.add_deduction_rate": "Menetapkan potongan cuti per hari",
};

export const entityLabels: Record<string, string> = {
  User: "Pengguna",
  Team: "Tim",
  Pharmacy: "Apotek",
  Placement: "Penempatan",
  Product: "Produk",
  SalesTarget: "Target omzet",
  Setting: "Pengaturan",
  DeductionRate: "Potongan cuti",
};

const fieldLabels: Record<string, string> = {
  name: "Nama",
  phone: "Nomor HP",
  kasirPhone: "HP kasir",
  role: "Peran",
  status: "Status",
  mustChangePassword: "Wajib ganti sandi",
  teamName: "Tim",
  leaderName: "Team Leader",
  address: "Alamat",
  latitude: "Lintang",
  longitude: "Bujur",
  radiusM: "Radius (m)",
  is24h: "Buka 24 jam",
  openTime: "Jam buka",
  closeTime: "Jam tutup",
  spgName: "SPG",
  pharmacyName: "Apotek",
  startedAt: "Mulai",
  endedAt: "Berakhir",
  endReason: "Alasan",
  code: "Kode",
  unit: "Satuan",
  price: "Harga",
  isActive: "Aktif",
  month: "Bulan",
  amount: "Target",
  days: "Jatah cuti (hari)",
  amountPerDay: "Potongan per hari",
  effectiveFrom: "Berlaku sejak",
};

const FIELD_ORDER = Object.keys(fieldLabels);
const MONEY_FIELDS = new Set(["price", "amount", "amountPerDay"]);
const HIDDEN_FIELDS = new Set(["id", "createdAt", "updatedAt", "lastLoginAt"]);
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  INACTIVE: "Nonaktif",
  PROSPECT: "Calon mitra",
};

export const fieldLabel = (key: string) => fieldLabels[key] ?? key;

export const formatAuditValue = (key: string, value: unknown): string => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Ya" : "Tidak";
  if (key === "role" && typeof value === "string" && value in roleLabels) return roleLabels[value as UserRole];
  if (key === "status" && typeof value === "string") return STATUS_LABELS[value] ?? value;
  if ((key === "phone" || key === "kasirPhone") && typeof value === "string") return formatPhone(value);
  if (MONEY_FIELDS.has(key)) return formatCurrency(String(value));
  if (key === "month" && typeof value === "string" && /^\d{4}-\d{2}$/.test(value)) return formatMonth(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return formatDateTime(value);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

/** Kolom yang ditampilkan: yang berubah (ubah) atau semua nilai (buat/hapus), tanpa ID internal. */
export function auditChanges(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].filter(
    (key) => !HIDDEN_FIELDS.has(key) && !key.endsWith("Id"),
  );

  // JSONB di Postgres tidak menyimpan urutan key; urutkan sesuai daftar label supaya mudah dibaca.
  const order = (key: string) => {
    const index = FIELD_ORDER.indexOf(key);
    return index === -1 ? FIELD_ORDER.length : index;
  };

  return keys
    .sort((a, b) => order(a) - order(b))
    .map((key) => ({ key, before: before?.[key], after: after?.[key] }))
    .filter((change) => !before || !after || JSON.stringify(change.before) !== JSON.stringify(change.after));
}

/** Nama data yang dicatat, diambil dari isi riwayat (mis. nama apotek atau "SPG · Apotek"). */
export function auditSubject(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const source = { ...before, ...after };
  if (typeof source.name === "string") return source.name;
  const pair = [source.spgName, source.pharmacyName].filter((part) => typeof part === "string");
  return pair.length > 0 ? pair.join(" · ") : null;
}
