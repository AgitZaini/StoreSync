import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Overview } from "../../types/master-data";

export function useOverview(enabled: boolean) {
  return useQuery({
    queryKey: ["overview"],
    queryFn: async () => (await api.get<{ overview: Overview }>("/dashboard/overview")).data.overview,
    enabled,
  });
}
