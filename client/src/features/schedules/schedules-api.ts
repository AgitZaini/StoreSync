import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { ScheduleValue, ScheduleWeek } from "../../types/attendance";

export type ScheduleFilters = { teamId?: string; pharmacyId?: string };

export const scheduleWeekQuery = (weekStart: string, filters: ScheduleFilters = {}) => ({
  queryKey: ["schedule-week", weekStart, filters],
  queryFn: async () => (await api.get<ScheduleWeek>("/schedules", { params: { weekStart, ...filters } })).data,
});

export function useScheduleWeek(weekStart: string, filters: ScheduleFilters = {}) {
  return useQuery(scheduleWeekQuery(weekStart, filters));
}

export type ScheduleEntryInput = { spgId: string; pharmacyId: string; date: string; value: ScheduleValue | null };

export function useSaveScheduleWeek(weekStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entries: ScheduleEntryInput[]) =>
      (await api.put<ScheduleWeek>(`/schedules/week/${weekStart}`, { entries })).data,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["schedule-week"] }),
        queryClient.invalidateQueries({ queryKey: ["attendance-monitor"] }),
      ]),
  });
}
