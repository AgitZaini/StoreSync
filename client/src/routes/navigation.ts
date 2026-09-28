import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileBarChart,
  FileSignature,
  History,
  LayoutDashboard,
  ListChecks,
  MapPin,
  MapPinned,
  Package,
  PackageCheck,
  PackagePlus,
  Plane,
  ReceiptText,
  ScanFace,
  Settings,
  ShoppingBag,
  Store,
  Undo2,
  UserCheck,
  Users,
  Warehouse,
} from "lucide-react";
import type { NavItem } from "../components/layout";
import type { UserRole } from "../types/auth";

export type NavEntry = {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  group: "main" | "manage";
  description: string;
  /** Tahap pembangunan saat menu ini tersedia; tanpa nilai berarti sudah tersedia. */
  availableIn?: number;
  /** Tampil di navigasi bawah pada layar HP (maksimal 4 per peran). */
  mobilePrimary?: boolean;
  /** Label ringkas untuk navigasi bawah bila `label` terlalu panjang. */
  shortLabel?: string;
};

const home = (description: string): NavEntry => ({
  key: "dashboard",
  label: "Beranda",
  path: "/",
  icon: LayoutDashboard,
  group: "main",
  description,
  mobilePrimary: true,
});

// Mengikuti "Daftar layar" di PRD v2.0. Profil dan Notifikasi tersedia untuk semua peran lewat header.
export const roleNavigation: Record<UserRole, NavEntry[]> = {
  SUPER_ADMIN: [
    { ...home("Omzet vs target, persetujuan menunggu, dan selisih stok"), label: "Dashboard" },
    { key: "approvals", label: "Persetujuan", path: "/persetujuan", icon: ClipboardCheck, group: "main", description: "Order, retur, cuti, dan MOU yang menunggu keputusan", availableIn: 5, mobilePrimary: true },
    { key: "leader-map", label: "Peta Leader", shortLabel: "Peta", path: "/peta-leader", icon: MapPinned, group: "main", description: "Posisi terakhir dan jejak harian Team Leader", mobilePrimary: true },
    { key: "visit-evaluation", label: "Evaluasi Kunjungan", shortLabel: "Evaluasi", path: "/evaluasi-kunjungan", icon: ListChecks, group: "main", description: "Rencana kunjungan Team Leader vs kunjungan nyata" },
    { key: "stock-opname", label: "Stock Opname", path: "/stock-opname", icon: ClipboardList, group: "main", description: "Hasil stock opname dan selisih stok", availableIn: 7 },
    { key: "users", label: "Pengguna & Penempatan", shortLabel: "Pengguna", path: "/pengguna", icon: Users, group: "manage", description: "Akun, peran, tim leader, dan penempatan SPG", mobilePrimary: true },
    { key: "pharmacies", label: "Apotek", path: "/apotek", icon: Store, group: "manage", description: "Data apotek, titik lokasi, dan radius absen" },
    { key: "products", label: "Produk & Target", path: "/produk", icon: Package, group: "manage", description: "Produk, harga jual, dan target omzet SPG" },
    { key: "audit-log", label: "Riwayat", path: "/riwayat", icon: History, group: "manage", description: "Semua persetujuan, penolakan, dan koreksi" },
    { key: "settings", label: "Pengaturan", path: "/pengaturan", icon: Settings, group: "manage", description: "Jatah cuti, potongan per hari, dan templat MOU" },
  ],
  ADMIN: [
    { ...home("Absen hari ini, laporan tertunda, order dan retur yang perlu diproses"), label: "Dashboard" },
    { key: "schedules", label: "Jadwal Mingguan", shortLabel: "Jadwal", path: "/jadwal", icon: CalendarDays, group: "main", description: "Input jadwal SPG per apotek per minggu", mobilePrimary: true },
    { key: "attendance-monitor", label: "Pemantauan Absen", shortLabel: "Absen", path: "/pemantauan-absen", icon: UserCheck, group: "main", description: "Tepat waktu, telat, dan tidak masuk dibanding jadwal", mobilePrimary: true },
    { key: "leader-map", label: "Peta Leader", shortLabel: "Peta", path: "/peta-leader", icon: MapPinned, group: "main", description: "Posisi terakhir dan jejak harian Team Leader" },
    { key: "visit-evaluation", label: "Evaluasi Kunjungan", path: "/evaluasi-kunjungan", icon: ListChecks, group: "main", description: "Rencana kunjungan Team Leader vs kunjungan nyata" },
    { key: "warehouse", label: "Stok Pusat", shortLabel: "Stok", path: "/stok-pusat", icon: Warehouse, group: "main", description: "Barang masuk dan mutasi gudang pusat", availableIn: 5, mobilePrimary: true },
    { key: "incoming-orders", label: "Order Masuk", path: "/order-masuk", icon: PackageCheck, group: "main", description: "Order disetujui yang siap dikirim", availableIn: 5 },
    { key: "incoming-returns", label: "Retur Masuk", path: "/retur-masuk", icon: Undo2, group: "main", description: "Retur yang perlu diterima di gudang", availableIn: 6 },
    { key: "stock-opname", label: "Stock Opname", path: "/stock-opname", icon: ClipboardList, group: "manage", description: "Periode bulanan, hitung fisik, koreksi, dan serah terima", availableIn: 7 },
    { key: "recap", label: "Rekap", path: "/rekap", icon: FileBarChart, group: "manage", description: "Keterlambatan, selisih stok, dan order tidak terpenuhi", availableIn: 9 },
  ],
  TEAM_LEADER: [
    home("Omzet dan stok SPG tim, absen tim, serta rencana vs kunjungan"),
    { key: "visit-attendance", label: "Absen Kunjungan", shortLabel: "Kunjungan", path: "/absen-kunjungan", icon: MapPin, group: "main", description: "Absen masuk dan keluar di setiap apotek", mobilePrimary: true },
    { key: "visit-plan", label: "Rencana Kunjungan", shortLabel: "Rencana", path: "/rencana-kunjungan", icon: CalendarRange, group: "main", description: "Daftar apotek yang dikunjungi per hari dan evaluasinya", mobilePrimary: true },
    { key: "team", label: "Tim Saya", shortLabel: "Tim", path: "/tim", icon: Users, group: "main", description: "Jadwal, absen, omzet, dan stok SPG tim", mobilePrimary: true },
    { key: "mou", label: "MOU Apotek Baru", path: "/mou", icon: FileSignature, group: "manage", description: "Daftarkan apotek calon mitra dan tanda tangan MOU", availableIn: 8 },
    { key: "leave", label: "Cuti & Izin", path: "/cuti", icon: Plane, group: "manage", description: "Ajukan cuti atau izin sakit dan lihat sisa jatah", availableIn: 8 },
  ],
  SPG: [
    home("Omzet vs target, sisa stok, jadwal, dan status pengajuan"),
    { key: "attendance", label: "Absen", path: "/absen", icon: ScanFace, group: "main", description: "Absen masuk dan pulang dengan foto dan lokasi", mobilePrimary: true },
    { key: "sales-report", label: "Laporan Penjualan", shortLabel: "Laporan", path: "/laporan-penjualan", icon: ReceiptText, group: "main", description: "Laporan harian yang disetujui kasir apotek", availableIn: 6, mobilePrimary: true },
    { key: "my-stock", label: "Stok Saya", shortLabel: "Stok", path: "/stok-saya", icon: Package, group: "main", description: "Sisa stok per apotek tugas", availableIn: 5, mobilePrimary: true },
    { key: "my-schedule", label: "Jadwal", path: "/jadwal-saya", icon: CalendarCheck, group: "main", description: "Jadwal minggu ini dan minggu depan" },
    { key: "orders", label: "Order Barang", path: "/order", icon: PackagePlus, group: "main", description: "Ajukan order dan konfirmasi barang diterima", availableIn: 5 },
    { key: "returns", label: "Retur", path: "/retur", icon: ArrowLeftRight, group: "manage", description: "Kembalikan barang ke gudang pusat", availableIn: 6 },
    { key: "leave", label: "Cuti & Izin", path: "/cuti", icon: Plane, group: "manage", description: "Ajukan cuti atau izin sakit", availableIn: 8 },
    { key: "requests", label: "Riwayat Pengajuan", path: "/riwayat-pengajuan", icon: History, group: "manage", description: "Status order, retur, dan cuti", availableIn: 5 },
  ],
  KASIR: [
    home("Laporan penjualan dan retur yang menunggu persetujuan apotek"),
    { key: "cashier-approvals", label: "Menunggu Persetujuan", shortLabel: "Persetujuan", path: "/persetujuan-kasir", icon: ShoppingBag, group: "main", description: "Setujui atau tolak laporan penjualan dan retur SPG", availableIn: 6, mobilePrimary: true },
    { key: "cashier-history", label: "Riwayat Persetujuan", shortLabel: "Riwayat", path: "/riwayat-persetujuan", icon: History, group: "main", description: "Persetujuan yang sudah diberikan apotek", availableIn: 6, mobilePrimary: true },
  ],
};

export const toNavItem = (entry: NavEntry): NavItem => ({
  key: entry.key,
  label: entry.label,
  path: entry.path,
  icon: entry.icon,
  group: entry.group,
  disabled: entry.availableIn !== undefined,
  disabledHint: entry.availableIn !== undefined ? `${entry.label} tersedia di tahap ${entry.availableIn}` : undefined,
});

const COMMON_PATHS = ["/", "/profil", "/notifikasi"];

/** Apakah `path` adalah halaman yang tersedia untuk `role`; dipakai sebelum kembali ke halaman terakhir. */
export const isPathAvailableForRole = (role: UserRole, path: string) =>
  COMMON_PATHS.includes(path) ||
  roleNavigation[role].some(
    (entry) =>
      entry.availableIn === undefined && entry.path !== "/" && (path === entry.path || path.startsWith(`${entry.path}/`)),
  );
