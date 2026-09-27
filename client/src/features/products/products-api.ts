import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Product, TargetsResponse } from "../../types/master-data";

export function useProducts({ includeInactive = false } = {}) {
  return useQuery({
    queryKey: ["products", { includeInactive }],
    queryFn: async () =>
      (await api.get<{ products: Product[] }>("/products", { params: includeInactive ? { includeInactive } : {} })).data
        .products,
  });
}

export type ProductInput = { code: string; name: string; unit: string; price: number; isActive?: boolean };

export function useSaveProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, ...input }: Partial<ProductInput> & { productId?: string }) =>
      productId
        ? (await api.patch<{ product: Product }>(`/products/${productId}`, input)).data.product
        : (await api.post<{ product: Product }>("/products", input)).data.product,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["overview"] }),
      ]),
  });
}

export function useTargets(month: string) {
  return useQuery({
    queryKey: ["targets", month],
    queryFn: async () => (await api.get<TargetsResponse>("/targets", { params: { month } })).data,
  });
}

export function useSaveTargets(month: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (targets: Array<{ spgId: string; amount: number | null }>) =>
      (await api.put<TargetsResponse>(`/targets/${month}`, { targets })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(["targets", month], data);
      return queryClient.invalidateQueries({ queryKey: ["overview"] });
    },
  });
}
