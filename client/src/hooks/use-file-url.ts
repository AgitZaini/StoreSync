import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

/** URL unduh sementara (5 menit) untuk berkas di R2/MinIO, misalnya foto absen. */
export function useFileUrl(fileId: string | null | undefined) {
  return useQuery({
    queryKey: ["file-url", fileId],
    queryFn: async () => (await api.get<{ downloadUrl: string }>(`/files/${fileId}`)).data.downloadUrl,
    enabled: Boolean(fileId),
    staleTime: 4 * 60 * 1000,
  });
}
