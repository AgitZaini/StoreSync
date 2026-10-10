import type { UserRole } from "./auth";

type Ref = { id: string; name: string };

export type ProductRef = Ref & { code: string; unit: string };

export type WarehouseStockRow = {
  product: ProductRef & { price: string; isActive: boolean };
  qty: number;
  /** Jumlah di order yang belum dikirim (diajukan/disetujui). */
  pendingOrderQty: number;
  updatedAt: string | null;
};

export type WarehouseMovementType = "INBOUND" | "ORDER_SHIPPED" | "RETURN_RECEIVED" | "ADJUSTMENT";

export type WarehouseMovement = {
  id: string;
  type: WarehouseMovementType;
  qty: number;
  balanceAfter: number;
  date: string;
  poNumber: string | null;
  note: string | null;
  createdAt: string;
  product: ProductRef;
  createdBy: Ref;
  order: { id: string; code: string; spgName: string; pharmacyName: string } | null;
};

export type OrderStatus = "SUBMITTED" | "APPROVED" | "SHIPPED" | "RECEIVED" | "REJECTED";

export type OrderItem = {
  id: string;
  requestedQty: number;
  stockAtSubmit: number;
  unfulfilledAtSubmit: boolean;
  approvedQty: number | null;
  shippedQty: number | null;
  receivedQty: number | null;
  product: ProductRef;
};

export type Order = {
  id: string;
  number: number;
  code: string;
  status: OrderStatus;
  note: string | null;
  submittedAt: string;
  decidedAt: string | null;
  rejectReason: string | null;
  shippedAt: string | null;
  shipNote: string | null;
  receivedAt: string | null;
  receiveNote: string | null;
  hasDiscrepancy: boolean;
  discrepancyResolvedAt: string | null;
  discrepancyNote: string | null;
  spg: Ref & { phone: string; team: Ref | null };
  pharmacy: Ref & { address: string };
  shippedBy: Ref | null;
  discrepancyResolvedBy: Ref | null;
  items: OrderItem[];
  approvals: Array<{ id: string; step: string; decision: "APPROVED" | "REJECTED"; reason: string | null; decidedAt: string; approver: Ref }>;
};

export type ItemQuantity = { itemId: string; qty: number };

export type RecapRow = {
  product: ProductRef & { isActive: boolean };
  warehouseQty: number;
  openQty: number;
  openOrders: number;
  toPurchase: number;
  requestedQty: number;
  unfulfilledAtSubmitQty: number;
  unfulfilledOrders: number;
  shortShippedQty: number;
};

export type RecapResponse = {
  from: string;
  to: string;
  rows: RecapRow[];
  totals: { toPurchase: number; unfulfilledAtSubmitQty: number; shortShippedQty: number };
};

export type FieldStockGroup = {
  holder: Ref & { role: UserRole; team: Ref | null };
  pharmacy: Ref;
  /** Penempatan aktif pasangan ini, bila ada. */
  placementId: string | null;
  items: Array<{ product: ProductRef & { price: string }; qty: number; updatedAt: string }>;
  totalQty: number;
  hasOpening: boolean;
  /** Sudah ada transaksi selain stok awal, jadi stok awal tidak bisa diubah lagi. */
  openingLocked: boolean;
};

export type FieldStockMovementType =
  | "OPENING"
  | "ORDER_RECEIVED"
  | "SALE_APPROVED"
  | "RETURN_RECEIVED"
  | "CORRECTION"
  | "HANDOVER_OUT"
  | "HANDOVER_IN";

export type FieldStockMovement = {
  id: string;
  type: FieldStockMovementType;
  qty: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
  product: ProductRef;
  createdBy: Ref;
  order: { id: string; code: string } | null;
};
