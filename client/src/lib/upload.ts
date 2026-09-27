import type { FilePurpose, PresignResponse, StoredFile } from "../types/file";
import { api } from "./api";

const COMPRESSIBLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Foto dikecilkan ke ±200 KB (sisi terpanjang 1280 px) supaya absen tetap cepat di 4G. */
const compressImage = async (file: File) => {
  // Dimuat saat dibutuhkan supaya tidak memperberat halaman pertama di HP kelas bawah.
  const { default: imageCompression } = await import("browser-image-compression");

  return imageCompression(file, {
    maxSizeMB: 0.2,
    maxWidthOrHeight: 1280,
    fileType: "image/jpeg",
    initialQuality: 0.8,
    // Mode web worker memuat script dari CDN jsdelivr; kompresi di thread utama cukup untuk satu foto.
    useWebWorker: false,
  });
};

/**
 * Mengunggah berkas langsung ke penyimpanan (R2/MinIO) lewat URL presigned,
 * lalu meminta server memverifikasinya. Mengembalikan berkas yang sudah UPLOADED.
 */
export async function uploadFile(source: File, purpose: FilePurpose): Promise<StoredFile> {
  const file = COMPRESSIBLE_TYPES.has(source.type) ? await compressImage(source) : source;

  const { data } = await api.post<PresignResponse>("/files/presign", {
    purpose,
    mimeType: file.type,
    size: file.size,
  });

  const response = await fetch(data.upload.url, {
    method: data.upload.method,
    headers: data.upload.headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error("Gagal mengunggah berkas. Coba lagi.");
  }

  const completed = await api.post<{ file: StoredFile }>(`/files/${data.file.id}/complete`);
  return completed.data.file;
}
