import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Settings } from "../../types/master-data";

const settingsKey = ["settings"] as const;

export function useSettings() {
  return useQuery({
    queryKey: settingsKey,
    queryFn: async () => (await api.get<{ settings: Settings }>("/settings")).data.settings,
  });
}

export function useUpdateLeaveQuota() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: number) => (await api.put<{ settings: Settings }>("/settings/leave-quota", { days })).data.settings,
    onSuccess: (settings) => queryClient.setQueryData(settingsKey, settings),
  });
}

export function useAddDeductionRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (amountPerDay: number) =>
      (await api.post<{ settings: Settings }>("/settings/deduction-rates", { amountPerDay })).data.settings,
    onSuccess: (settings) => queryClient.setQueryData(settingsKey, settings),
  });
}
