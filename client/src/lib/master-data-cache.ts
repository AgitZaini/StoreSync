import type { QueryClient } from "@tanstack/react-query";

// Data utama saling terkait (pengguna ↔ tim ↔ penempatan ↔ apotek) dan kecil, jadi setelah
// perubahan apa pun semua daftar terkait cukup dimuat ulang.
const MASTER_DATA_KEYS = ["users", "user", "teams", "pharmacies", "pharmacy", "placements", "targets", "overview"];

export const invalidateMasterData = (queryClient: QueryClient) =>
  Promise.all(MASTER_DATA_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })));
