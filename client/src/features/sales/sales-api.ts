import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  AvailableStockRow,
  CashierIdentity,
  PendingSalesReport,
  PerformanceResponse,
  ReturnDoc,
  ReturnStatus,
  SalesReport,
  SalesReportStatus,
} from "../../types/sales";

// Setiap keputusan mengubah stok, omzet, dan daftar tunggu; semuanya disegarkan bersama.
const SALES_KEYS = [
  "sales-reports",
  "sales-pending",
  "sales-performance",
  "available-stock",
  "returns",
  "field-stock",
  "field-movements",
  "warehouse-stock",
  "warehouse-movements",
  "overview",
];

const invalidateSales = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all(SALES_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));

type Items = Array<{ productId: string; qty: number }>;

// ——— Laporan penjualan (JUL-01…05) ———

export type SalesReportFilters = { status?: SalesReportStatus[]; pharmacyId?: string; spgId?: string; from?: string; to?: string };

export function useSalesReports(filters: SalesReportFilters = {}, { live = false, enabled = true } = {}) {
  return useQuery({
    queryKey: ["sales-reports", filters],
    queryFn: async () =>
      (await api.get<{ reports: SalesReport[] }>("/sales-reports", { params: { ...filters, status: filters.status?.join(",") } })).data.reports,
    refetchInterval: live ? 60 * 1000 : false,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useAvailableStock(pharmacyId: string | null, exclude: { excludeSalesReportId?: string; excludeReturnId?: string } = {}) {
  return useQuery({
    queryKey: ["available-stock", pharmacyId, exclude],
    queryFn: async () =>
      (await api.get<{ stock: AvailableStockRow[] }>("/field-stock/available", { params: { pharmacyId, ...exclude } })).data.stock,
    enabled: Boolean(pharmacyId),
  });
}

export function useSubmitSalesReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { reportId?: string; pharmacyId: string; reportDate?: string; note?: string; items: Items }) => {
      const { reportId, pharmacyId, reportDate, ...body } = input;
      return reportId
        ? (await api.put<{ report: SalesReport }>(`/sales-reports/${reportId}`, body)).data.report
        : (await api.post<{ report: SalesReport }>("/sales-reports", { pharmacyId, reportDate, ...body })).data.report;
    },
    onSuccess: () => invalidateSales(queryClient),
  });
}

export function useKasirSalesDecision() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportId, decision, ...body }: CashierIdentity & { reportId: string; decision: "approve" | "reject"; revision: number; reason?: string }) =>
      (await api.post<{ report: SalesReport }>(`/sales-reports/${reportId}/${decision}`, body)).data.report,
    onSuccess: () => invalidateSales(queryClient),
  });
}

export function usePendingSalesReports(olderThanDays: number) {
  return useQuery({
    queryKey: ["sales-pending", olderThanDays],
    queryFn: async () => (await api.get<{ reports: PendingSalesReport[] }>("/sales-reports/pending", { params: { olderThanDays } })).data.reports,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useSalesPerformance(month: string, { spgId, enabled = true }: { spgId?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["sales-performance", month, spgId ?? "all"],
    queryFn: async () => (await api.get<PerformanceResponse>("/sales-reports/performance", { params: { month, spgId } })).data,
    enabled,
    placeholderData: keepPreviousData,
  });
}

// ——— Retur (RTR-01…04) ———

export type ReturnFilters = { status?: ReturnStatus[]; pharmacyId?: string; spgId?: string };

export function useReturns(filters: ReturnFilters = {}, { live = false, enabled = true } = {}) {
  return useQuery({
    queryKey: ["returns", filters],
    queryFn: async () =>
      (await api.get<{ returns: ReturnDoc[] }>("/returns", { params: { ...filters, status: filters.status?.join(",") } })).data.returns,
    refetchInterval: live ? 60 * 1000 : false,
    enabled,
  });
}

export function useSubmitReturn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { pharmacyId: string; reason: string; photoFileId?: string; items: Items }) =>
      (await api.post<{ return: ReturnDoc }>("/returns", input)).data.return,
    onSuccess: () => invalidateSales(queryClient),
  });
}

type ReturnAction =
  | ({ action: "kasir-approve" } & CashierIdentity)
  | ({ action: "kasir-reject"; reason: string } & CashierIdentity)
  | { action: "approve"; note?: string }
  | { action: "reject"; reason: string }
  | { action: "receive"; items?: Array<{ itemId: string; qty: number }>; note?: string };

export function useReturnAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ returnId, action, ...body }: ReturnAction & { returnId: string }) =>
      (await api.post<{ return: ReturnDoc }>(`/returns/${returnId}/${action}`, body)).data.return,
    onSuccess: () => invalidateSales(queryClient),
  });
}
