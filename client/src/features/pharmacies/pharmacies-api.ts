import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { invalidateMasterData } from "../../lib/master-data-cache";
import type { Pharmacy, PharmacyStatus } from "../../types/master-data";

export type PharmacyFilters = { status?: PharmacyStatus; q?: string };

/** Untuk Admin/Super Admin respons berisi akun kasir dan penempatan; peran lain hanya data dasar. */
export function usePharmacies(filters: PharmacyFilters = {}) {
  return useQuery({
    queryKey: ["pharmacies", filters],
    queryFn: async () => (await api.get<{ pharmacies: Pharmacy[] }>("/pharmacies", { params: filters })).data.pharmacies,
  });
}

export function usePharmacy(pharmacyId: string | undefined) {
  return useQuery({
    queryKey: ["pharmacy", pharmacyId],
    queryFn: async () => (await api.get<{ pharmacy: Pharmacy }>(`/pharmacies/${pharmacyId}`)).data.pharmacy,
    enabled: Boolean(pharmacyId),
  });
}

export type PharmacyInput = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusM: number;
  is24h: boolean;
  openTime: string | null;
  closeTime: string | null;
  kasirPhone: string;
  kasirPassword?: string;
};

export function useSavePharmacy(pharmacyId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PharmacyInput) =>
      pharmacyId
        ? (await api.patch<{ pharmacy: Pharmacy }>(`/pharmacies/${pharmacyId}`, input)).data.pharmacy
        : (await api.post<{ pharmacy: Pharmacy }>("/pharmacies", input)).data.pharmacy,
    onSuccess: () => invalidateMasterData(queryClient),
  });
}

export function useUpdatePharmacyStatus(pharmacyId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (status: "ACTIVE" | "INACTIVE") =>
      (await api.patch<{ pharmacy: Pharmacy }>(`/pharmacies/${pharmacyId}/status`, { status })).data.pharmacy,
    onSuccess: () => invalidateMasterData(queryClient),
  });
}
