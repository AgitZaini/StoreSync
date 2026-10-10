import type { PillTone } from "../../components/ui";
import type { FieldStockMovementType, Order, OrderStatus, WarehouseMovementType } from "../../types/stock";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: PillTone }> = {
  SUBMITTED: { label: "Menunggu persetujuan", tone: "orange" },
  APPROVED: { label: "Disetujui, menunggu kirim", tone: "blue" },
  SHIPPED: { label: "Dikirim", tone: "violet" },
  RECEIVED: { label: "Diterima", tone: "green" },
  REJECTED: { label: "Ditolak", tone: "red" },
};

export const WAREHOUSE_MOVEMENT: Record<WarehouseMovementType, string> = {
  INBOUND: "Barang masuk",
  ORDER_SHIPPED: "Kirim order",
  RETURN_RECEIVED: "Retur diterima",
  ADJUSTMENT: "Penyesuaian",
};

export const FIELD_MOVEMENT: Record<FieldStockMovementType, string> = {
  OPENING: "Stok awal",
  ORDER_RECEIVED: "Order diterima",
  SALE_APPROVED: "Penjualan disetujui",
  RETURN_RECEIVED: "Retur ke gudang",
  CORRECTION: "Koreksi",
  HANDOVER_OUT: "Serah terima keluar",
  HANDOVER_IN: "Serah terima masuk",
};

/** Order yang masih berjalan (belum diterima atau ditolak). */
export const isOpenOrder = (order: Order) => ["SUBMITTED", "APPROVED", "SHIPPED"].includes(order.status);

export const formatQty = (qty: number) => new Intl.NumberFormat("id-ID").format(qty);

export const formatSignedQty = (qty: number) => `${qty > 0 ? "+" : ""}${formatQty(qty)}`;
