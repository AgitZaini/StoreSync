import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  FieldStockGroup,
  FieldStockMovement,
  ItemQuantity,
  Order,
  OrderStatus,
  RecapResponse,
  WarehouseMovement,
  WarehouseMovementType,
  WarehouseStockRow,
} from "../../types/stock";

// Kunci query bersama: setiap perubahan stok/order menyegarkan semuanya supaya angka tidak basi.
const STOCK_KEYS = ["warehouse-stock", "warehouse-movements", "orders", "order-recap", "field-stock", "field-movements", "overview"];

const invalidateStock = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all(STOCK_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

// ——— Stok pusat (STK-01) ———

export function useWarehouseStock(enabled = true) {
  return useQuery({
    queryKey: ["warehouse-stock"],
    queryFn: async () => (await api.get<{ stock: WarehouseStockRow[] }>("/warehouse/stock")).data.stock,
    enabled,
  });
}

export type MovementFilters = { productId?: string; type?: WarehouseMovementType; from?: string; to?: string };

export function useWarehouseMovements(filters: MovementFilters) {
  return useQuery({
    queryKey: ["warehouse-movements", filters],
    queryFn: async () => (await api.get<{ movements: WarehouseMovement[] }>("/warehouse/movements", { params: filters })).data.movements,
    placeholderData: keepPreviousData,
  });
}

export function useRecordInbound() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { date: string; poNumber?: string; note?: string; items: Array<{ productId: string; qty: number }> }) =>
      (await api.post("/warehouse/inbound", input)).data,
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useAdjustWarehouse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { productId: string; qty: number; reason: string }) => (await api.post("/warehouse/adjustments", input)).data,
    onSuccess: () => invalidateStock(queryClient),
  });
}

// ——— Order (ORD-01…05) ———

export type OrderFilters = { status?: OrderStatus[]; openDiscrepancy?: boolean; spgId?: string };

export function useOrders(filters: OrderFilters = {}, { enabled = true, live = false } = {}) {
  return useQuery({
    queryKey: ["orders", filters],
    queryFn: async () =>
      (
        await api.get<{ orders: Order[] }>("/orders", {
          params: {
            status: filters.status?.join(","),
            openDiscrepancy: filters.openDiscrepancy ? "true" : undefined,
            spgId: filters.spgId,
          },
        })
      ).data.orders,
    enabled,
    refetchInterval: live ? 60 * 1000 : false,
  });
}

export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pharmacyId: string; note?: string; items: Array<{ productId: string; qty: number }> }) =>
      (await api.post<{ order: Order }>("/orders", input)).data.order,
    onSuccess: () => invalidateStock(queryClient),
  });
}

type OrderAction =
  | { action: "approve"; items?: ItemQuantity[]; note?: string }
  | { action: "reject"; reason: string }
  | { action: "ship"; items?: ItemQuantity[]; note?: string }
  | { action: "receive"; items?: ItemQuantity[]; note?: string }
  | { action: "resolve-discrepancy"; note: string };

export function useOrderAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, action, ...body }: OrderAction & { orderId: string }) =>
      (await api.post<{ order: Order }>(`/orders/${orderId}/${action}`, body)).data.order,
    onSuccess: () => invalidateStock(queryClient),
  });
}

export function useOrderRecap(range: { from: string; to: string }) {
  return useQuery({
    queryKey: ["order-recap", range],
    queryFn: async () => (await api.get<RecapResponse>("/orders/unfulfilled-recap", { params: range })).data,
    placeholderData: keepPreviousData,
  });
}

// ——— Stok lapangan (AB-05) ———

export function useFieldStock(filters: { holderId?: string; pharmacyId?: string } = {}, enabled = true) {
  return useQuery({
    queryKey: ["field-stock", filters],
    queryFn: async () => (await api.get<{ groups: FieldStockGroup[] }>("/field-stock", { params: filters })).data.groups,
    enabled,
  });
}

export function useFieldMovements(pair: { holderId: string; pharmacyId: string } | null) {
  return useQuery({
    queryKey: ["field-movements", pair],
    queryFn: async () => (await api.get<{ movements: FieldStockMovement[] }>("/field-stock/movements", { params: pair })).data.movements,
    enabled: Boolean(pair),
  });
}

export function useSetOpeningStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { spgId: string; pharmacyId: string; items: Array<{ productId: string; qty: number }> }) =>
      (await api.put<{ changes: string[]; stock: FieldStockGroup | null }>("/field-stock/opening", input)).data,
    onSuccess: () => invalidateStock(queryClient),
  });
}
