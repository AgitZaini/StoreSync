import type { PillTone } from "../../components/ui";
import type { ReturnStatus, SalesReportStatus } from "../../types/sales";

export const REPORT_STATUS: Record<SalesReportStatus, { label: string; tone: PillTone }> = {
  SUBMITTED: { label: "Menunggu kasir", tone: "orange" },
  APPROVED: { label: "Disetujui kasir", tone: "green" },
  REJECTED: { label: "Ditolak kasir", tone: "red" },
};

export const RETURN_STATUS: Record<ReturnStatus, { label: string; tone: PillTone }> = {
  SUBMITTED: { label: "Menunggu kasir", tone: "orange" },
  KASIR_APPROVED: { label: "Menunggu Super Admin", tone: "blue" },
  SA_APPROVED: { label: "Kirim ke gudang", tone: "violet" },
  RECEIVED: { label: "Diterima gudang", tone: "green" },
  REJECTED: { label: "Ditolak", tone: "red" },
};

export const APPROVAL_STEP = { KASIR: "kasir", SUPER_ADMIN: "Super Admin" } as const;

/** Nama kasir terakhir di perangkat ini, supaya tidak diketik ulang setiap persetujuan. */
const CASHIER_NAME_KEY = "storesync.cashierName";

export const readCashierName = () => {
  try {
    return localStorage.getItem(CASHIER_NAME_KEY) ?? "";
  } catch {
    return "";
  }
};

export const rememberCashierName = (name: string) => {
  try {
    localStorage.setItem(CASHIER_NAME_KEY, name);
  } catch {
    // Penyimpanan diblokir (mode privat); nama cukup diketik ulang.
  }
};
