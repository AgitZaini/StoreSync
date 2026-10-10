import type { FaceCheck } from "./attendance";
import type { ProductRef } from "./stock";

type Ref = { id: string; name: string };

/** Keputusan persetujuan (kasir atau Super Admin) pada sebuah dokumen. */
export type ApprovalView = {
  id: string;
  step: "KASIR" | "SUPER_ADMIN";
  decision: "APPROVED" | "REJECTED";
  reason: string | null;
  cashierName: string | null;
  cashierPhotoFileId: string | null;
  decidedAt: string;
  approver: Ref;
};

export type SalesReportStatus = "SUBMITTED" | "APPROVED" | "REJECTED";

export type SalesReport = {
  id: string;
  number: number;
  code: string;
  reportDate: string;
  status: SalesReportStatus;
  totalAmount: string;
  revision: number;
  note: string | null;
  submittedAt: string;
  decidedAt: string | null;
  rejectReason: string | null;
  spg: Ref & { phone: string; team: Ref | null };
  pharmacy: Ref & { address: string; kasir: (Ref & { phone: string }) | null };
  items: Array<{ id: string; qty: number; unitPrice: string; subtotal: string; product: ProductRef }>;
  approvals: ApprovalView[];
};

export type PendingSalesReport = SalesReport & { hoursWaiting: number };

export type ReturnStatus = "SUBMITTED" | "KASIR_APPROVED" | "SA_APPROVED" | "RECEIVED" | "REJECTED";

export type ReturnDoc = {
  id: string;
  number: number;
  code: string;
  status: ReturnStatus;
  reason: string;
  photoFileId: string | null;
  submittedAt: string;
  kasirDecidedAt: string | null;
  saDecidedAt: string | null;
  rejectReason: string | null;
  rejectedStep: "KASIR" | "SUPER_ADMIN" | null;
  receivedAt: string | null;
  receiveNote: string | null;
  hasDiscrepancy: boolean;
  spg: Ref & { phone: string; team: Ref | null };
  pharmacy: Ref & { address: string };
  receivedBy: Ref | null;
  items: Array<{ id: string; qty: number; receivedQty: number | null; product: ProductRef }>;
  approvals: ApprovalView[];
};

/** BR-14: stok yang masih bisa dilaporkan terjual atau diretur. */
export type AvailableStockRow = {
  product: ProductRef & { price: string };
  onHand: number;
  pendingSales: number;
  pendingReturns: number;
  available: number;
};

export type PerformanceRow = {
  spg: Ref & { team: Ref | null };
  target: string | null;
  approvedAmount: string;
  approvedReports: number;
  pendingAmount: string;
  pendingReports: number;
  percent: number | null;
};

export type PerformanceResponse = {
  month: string;
  rows: PerformanceRow[];
  totals: { target: string; approvedAmount: string; pendingAmount: string; percent: number | null };
  daily: Array<{ date: string; amount: string }>;
};

/** Identitas kasir untuk setiap keputusan (AB-07). */
export type CashierIdentity = { cashierName: string; cashierPhotoFileId: string; faceCheck?: FaceCheck };
