import { roleLabels } from "../../lib/roles";
import { formatBusinessDate, formatCurrency, formatDateTime, formatMonth, formatPhone } from "../../lib/format";
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
  "setting.update_attendance": "Mengubah pengaturan absen",
  "schedule.set": "Mengisi jadwal SPG",
  "schedule.delete": "Menghapus jadwal SPG",
  "attendance.check_in": "Absen masuk",
  "attendance.check_out": "Absen pulang",
  "attendance.note": "Mencatat alasan telat/tidak masuk",
  "attendance_exception.create": "Mengajukan pengecualian absen",
  "attendance_exception.approve": "Menyetujui pengecualian absen",
  "attendance_exception.reject": "Menolak pengecualian absen",
  "leader_visit.check_in": "Absen masuk kunjungan",
  "leader_visit.check_out": "Absen keluar kunjungan",
  "leader_workday.end": "Menyelesaikan hari kerja",
  "visit_plan.update": "Menyusun rencana kunjungan",
  "visit_plan.update_after_lock": "Mengubah rencana kunjungan setelah terkunci",
  "visit_plan.miss_reason": "Mengisi alasan apotek tidak dikunjungi",
  "warehouse.inbound": "Mencatat barang masuk gudang",
  "warehouse.adjust": "Menyesuaikan stok pusat",
  "order.submit": "Mengajukan order",
  "order.approve": "Menyetujui order",
  "order.reject": "Menolak order",
  "order.ship": "Mengirim order",
  "order.receive": "Menerima order",
  "order.resolve_discrepancy": "Menindaklanjuti selisih order",
  "field_stock.opening": "Mengisi stok awal SPG",
  "sales_report.submit": "Mengirim laporan penjualan",
  "sales_report.resubmit": "Memperbaiki laporan penjualan",
  "sales_report.approve": "Kasir menyetujui laporan penjualan",
  "sales_report.reject": "Kasir menolak laporan penjualan",
  "return.submit": "Mengajukan retur",
  "return.kasir_approve": "Kasir menyetujui retur",
  "return.kasir_reject": "Kasir menolak retur",
  "return.sa_approve": "Menyetujui retur",
  "return.sa_reject": "Menolak retur",
  "return.receive": "Menerima retur di gudang",
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
  Schedule: "Jadwal",
  Attendance: "Absen",
  AttendanceNote: "Catatan absen",
  AttendanceException: "Pengecualian absen",
  LeaderVisit: "Kunjungan leader",
  LeaderWorkDay: "Hari kerja leader",
  VisitPlan: "Rencana kunjungan",
  VisitPlanItem: "Evaluasi kunjungan",
  Order: "Order",
  WarehouseStock: "Stok pusat",
  FieldStock: "Stok SPG",
  SalesReport: "Laporan penjualan",
  Return: "Retur",
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
  weekStart: "Minggu",
  date: "Tanggal",
  businessDate: "Tanggal",
  pharmacies: "Apotek",
  added: "Ditambah",
  removed: "Dihapus",
  afterLock: "Setelah terkunci",
  checkInAt: "Jam masuk",
  checkOutAt: "Jam keluar",
  durationMin: "Lama (menit)",
  distanceM: "Jarak (m)",
  accuracyM: "Akurasi GPS (m)",
  workDayStarted: "Memulai hari kerja",
  workDayReopened: "Membuka lagi hari kerja",
  missReason: "Alasan",
  hasEvidence: "Ada bukti",
  maxAccuracyM: "Batas akurasi GPS (m)",
  lateToleranceMinutes: "Toleransi telat (menit)",
  leaderWorkEndTime: "Batas jam kerja leader",
  productName: "Produk",
  qty: "Jumlah",
  items: "Item",
  discrepancy: "Selisih",
  poNumber: "Nomor PO",
  reason: "Alasan",
  note: "Catatan",
  reportDate: "Tanggal penjualan",
  totalAmount: "Total omzet",
  revision: "Revisi",
  cashierName: "Nama kasir",
};

const FIELD_ORDER = Object.keys(fieldLabels);
const MONEY_FIELDS = new Set(["price", "amount", "amountPerDay", "totalAmount"]);
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
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatBusinessDate(value, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  if (Array.isArray(value)) return value.length === 0 ? "-" : value.join(", ");
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
  if (typeof source.code === "string") return [source.code, source.pharmacyName].filter((part) => typeof part === "string").join(" · ");
  if (typeof source.productName === "string") return source.productName;
  const pair = [source.spgName, source.pharmacyName].filter((part) => typeof part === "string");
  return pair.length > 0 ? pair.join(" · ") : null;
}
