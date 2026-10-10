import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AttendanceKind, FaceCheck } from "../../types/attendance";
import type {
  LeaderPositionsResponse,
  LeaderTrail,
  LeaderVisit,
  PingResponse,
  VisitPlanSummaryResponse,
  VisitPlanWeek,
  VisitTodayResponse,
} from "../../types/visits";

export const VISIT_TODAY_KEY = ["visit-today"] as const;

/** Sesi kerja + kunjungan hari ini; dipakai halaman Absen Kunjungan dan pelacak lokasi live. */
export function useVisitToday(enabled = true) {
  return useQuery({
    queryKey: VISIT_TODAY_KEY,
    queryFn: async () => (await api.get<VisitTodayResponse>("/visits/today")).data,
    refetchInterval: 60 * 1000,
    enabled,
  });
}

export type VisitAttendancePayload = {
  pharmacyId: string;
  kind: AttendanceKind;
  photoFileId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  faceCheck: FaceCheck;
};

const invalidateVisits = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all(
    [VISIT_TODAY_KEY, ["visit-plan"], ["leader-positions"], ["leader-trail"]].map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );

export function useSubmitVisitAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: VisitAttendancePayload) =>
      (await api.post<{ visit: LeaderVisit }>("/visits/attendance", payload)).data.visit,
    onSuccess: () => invalidateVisits(queryClient),
  });
}

export function useEndWorkDay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => (await api.post<VisitTodayResponse>("/visits/end-day")).data,
    onSuccess: (today) => {
      queryClient.setQueryData(VISIT_TODAY_KEY, today);
      return invalidateVisits(queryClient);
    },
  });
}

export async function sendLocationPing(position: { latitude: number; longitude: number; accuracyM: number }) {
  return (await api.post<PingResponse>("/locations/ping", position)).data;
}

export function useLeaderPositions(date: string, { live = false } = {}) {
  return useQuery({
    queryKey: ["leader-positions", date],
    queryFn: async () => (await api.get<LeaderPositionsResponse>("/locations/leaders", { params: { date } })).data,
    refetchInterval: live ? 60 * 1000 : false,
    placeholderData: keepPreviousData,
  });
}

export function useLeaderTrail(leaderId: string | null, date: string, { live = false } = {}) {
  return useQuery({
    queryKey: ["leader-trail", leaderId, date],
    queryFn: async () => (await api.get<LeaderTrail>(`/locations/leaders/${leaderId}/trail`, { params: { date } })).data,
    enabled: Boolean(leaderId),
    refetchInterval: live ? 60 * 1000 : false,
  });
}

export function useVisitPlan(weekStart: string, leaderId?: string | null, { enabled = true } = {}) {
  return useQuery({
    queryKey: ["visit-plan", weekStart, leaderId ?? "self"],
    queryFn: async () =>
      (await api.get<VisitPlanWeek>("/visit-plans", { params: leaderId ? { weekStart, leaderId } : { weekStart } })).data,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useVisitPlanSummary(weekStart: string) {
  return useQuery({
    queryKey: ["visit-plan-summary", weekStart],
    queryFn: async () => (await api.get<VisitPlanSummaryResponse>("/visit-plans/summary", { params: { weekStart } })).data,
    placeholderData: keepPreviousData,
  });
}

export function useSaveVisitPlan(weekStart: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (days: Array<{ date: string; pharmacyIds: string[] }>) =>
      (await api.put<VisitPlanWeek>(`/visit-plans/week/${weekStart}`, { days })).data,
    onSuccess: (week) => {
      queryClient.setQueryData(["visit-plan", weekStart, "self"], week);
      return queryClient.invalidateQueries({ queryKey: VISIT_TODAY_KEY });
    },
  });
}

export function useSaveMissReason() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, reason, evidenceFileId }: { itemId: string; reason: string; evidenceFileId?: string | null }) =>
      (await api.put<VisitPlanWeek>(`/visit-plans/items/${itemId}/reason`, { reason, evidenceFileId })).data,
    onSuccess: (week) => {
      queryClient.setQueryData(["visit-plan", week.weekStart, "self"], week);
      return queryClient.invalidateQueries({ queryKey: VISIT_TODAY_KEY });
    },
  });
}
