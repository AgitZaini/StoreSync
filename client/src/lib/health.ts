import { useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "../types/health";
import { api } from "./api";

/** Status koneksi ke API untuk indikator kecil di login dan sidebar. */
export function useApiHealth() {
  const query = useQuery({
    queryKey: ["health"],
    queryFn: async () => (await api.get<HealthResponse>("/health")).data,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  if (query.isPending) {
    return { label: "Memeriksa server", dot: "bg-amber-400" };
  }

  return query.isSuccess
    ? { label: "Server terhubung", dot: "bg-green-500" }
    : { label: "Server tidak terjangkau", dot: "bg-red-500" };
}
