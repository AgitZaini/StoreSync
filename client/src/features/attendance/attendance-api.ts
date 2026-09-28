import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type {
  AttendanceException,
  AttendanceHistoryItem,
  AttendanceKind,
  FaceCheck,
  MonitorResponse,
  TodayResponse,
} from "../../types/attendance";

export function useTodayAttendance() {
  return useQuery({
    queryKey: ["attendance-today"],
    queryFn: async () => (await api.get<TodayResponse>("/attendance/today")).data,
    refetchInterval: 60 * 1000,
  });
}

export function useAttendanceHistory(range: { from: string; to: string; spgId?: string }) {
  return useQuery({
    queryKey: ["attendance-history", range],
    queryFn: async () => (await api.get<{ attendances: AttendanceHistoryItem[] }>("/attendance", { params: range })).data.attendances,
  });
}

export function useAttendanceMonitor(date: string, { live = false } = {}) {
  return useQuery({
    queryKey: ["attendance-monitor", date],
    queryFn: async () => (await api.get<MonitorResponse>("/attendance/monitor", { params: { date } })).data,
    refetchInterval: live ? 60 * 1000 : false,
  });
}

export function useAttendanceExceptions(status?: AttendanceException["status"]) {
  return useQuery({
    queryKey: ["attendance-exceptions", status ?? "all"],
    queryFn: async () =>
      (await api.get<{ exceptions: AttendanceException[] }>("/attendance/exceptions", { params: status ? { status } : {} })).data
        .exceptions,
  });
}

export type AttendancePayload = {
  pharmacyId: string;
  kind: AttendanceKind;
  photoFileId: string;
  latitude: number;
  longitude: number;
  accuracyM: number;
  faceCheck: FaceCheck;
};

const invalidateAttendance = (queryClient: ReturnType<typeof useQueryClient>) =>
  Promise.all(
    ["attendance-today", "attendance-history", "attendance-monitor", "attendance-exceptions", "overview"].map((key) =>
      queryClient.invalidateQueries({ queryKey: [key] }),
    ),
  );

export function useSubmitAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AttendancePayload) => (await api.post("/attendance", payload)).data,
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useSubmitException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: AttendancePayload & { reason: string }) =>
      (await api.post<{ exception: AttendanceException }>("/attendance/exceptions", payload)).data.exception,
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useReviewException() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, decision, note }: { id: string; decision: "approve" | "reject"; note?: string }) =>
      (await api.post<{ exception: AttendanceException }>(`/attendance/exceptions/${id}/${decision}`, { note })).data.exception,
    onSuccess: () => invalidateAttendance(queryClient),
  });
}

export function useSaveAttendanceNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { spgId: string; pharmacyId: string; date: string; note: string }) =>
      (await api.put("/attendance/notes", input)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["attendance-monitor"] }),
  });
}
