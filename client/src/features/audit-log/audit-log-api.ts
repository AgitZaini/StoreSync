import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AuditLogPage } from "../../types/master-data";

export type AuditLogFilters = { entity?: string; entityId?: string; action?: string; from?: string; to?: string };

export function useAuditLog(filters: AuditLogFilters) {
  return useInfiniteQuery({
    queryKey: ["audit-log", filters],
    queryFn: async ({ pageParam }) =>
      (await api.get<AuditLogPage>("/audit-logs", { params: { ...filters, cursor: pageParam, limit: 30 } })).data,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
}
