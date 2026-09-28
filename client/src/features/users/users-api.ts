import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { invalidateMasterData } from "../../lib/master-data-cache";
import type { UserRole, UserStatus } from "../../types/auth";
import type { Placement, Team, UserDetail, UserSummary } from "../../types/master-data";

export type UserFilters = { role?: UserRole; status?: UserStatus; q?: string };

export function useUsers(filters: UserFilters = {}) {
  return useQuery({
    queryKey: ["users", filters],
    queryFn: async () => (await api.get<{ users: UserSummary[] }>("/users", { params: filters })).data.users,
  });
}

export function useUser(userId: string) {
  return useQuery({
    queryKey: ["user", userId],
    queryFn: async () => (await api.get<{ user: UserDetail }>(`/users/${userId}`)).data.user,
  });
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => (await api.get<{ teams: Team[] }>("/teams")).data.teams,
  });
}

/** Mutasi data utama yang memuat ulang semua daftar terkait setelah berhasil. */
function useMasterDataMutation<Variables, Result>(mutationFn: (variables: Variables) => Promise<Result>) {
  const queryClient = useQueryClient();

  return useMutation({ mutationFn, onSuccess: () => invalidateMasterData(queryClient) });
}

export type CreateUserInput = { name: string; phone: string; role: UserRole; password: string; teamId?: string | null };

export const useCreateUser = () =>
  useMasterDataMutation(async (input: CreateUserInput) => (await api.post<{ user: UserSummary }>("/users", input)).data.user);

export const useUpdateUser = (userId: string) =>
  useMasterDataMutation(async (input: Partial<Pick<CreateUserInput, "name" | "phone" | "role">>) =>
    (await api.patch(`/users/${userId}`, input)).data,
  );

export const useUpdateUserStatus = (userId: string) =>
  useMasterDataMutation(async (status: UserStatus) => (await api.patch(`/users/${userId}/status`, { status })).data);

export const useResetPassword = (userId: string) =>
  useMasterDataMutation(async (password: string) => api.post(`/users/${userId}/reset-password`, { password }));

export const useUpdateUserTeam = (userId: string) =>
  useMasterDataMutation(async (teamId: string | null) => (await api.patch(`/users/${userId}/team`, { teamId })).data);

export const useSaveTeam = () =>
  useMasterDataMutation(async ({ teamId, ...input }: { teamId?: string; name: string; leaderId: string }) =>
    teamId ? (await api.patch(`/teams/${teamId}`, input)).data : (await api.post("/teams", input)).data,
  );

export const useCreatePlacement = () =>
  useMasterDataMutation(async (input: { spgId: string; pharmacyId: string }) =>
    (await api.post<{ placement: Placement }>("/placements", input)).data.placement,
  );

export const useEndPlacement = () =>
  useMasterDataMutation(async ({ placementId, reason }: { placementId: string; reason: string }) =>
    (await api.post(`/placements/${placementId}/end`, { reason })).data,
  );
