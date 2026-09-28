import { FilePurpose } from "@prisma/client";
import { z } from "zod";

export const FILE_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type AllowedMimeType = keyof typeof FILE_EXTENSIONS;

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Foto bukti (absen, kasir, retur, dsb.) wajib gambar; hanya dokumen yang boleh PDF.
const PURPOSES_ACCEPTING_PDF = new Set<FilePurpose>([FilePurpose.DOCTOR_NOTE, FilePurpose.MOU_DOCUMENT]);

export const presignFileSchema = z
  .object({
    purpose: z.nativeEnum(FilePurpose),
    mimeType: z.enum(Object.keys(FILE_EXTENSIONS) as [AllowedMimeType, ...AllowedMimeType[]]),
    size: z.number().int().positive(),
  })
  .superRefine((input, ctx) => {
    const isPdf = input.mimeType === "application/pdf";

    if (isPdf && !PURPOSES_ACCEPTING_PDF.has(input.purpose)) {
      ctx.addIssue({ code: "custom", path: ["mimeType"], message: "Berkas ini harus berupa gambar" });
    }

    const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;

    if (input.size > maxBytes) {
      ctx.addIssue({
        code: "custom",
        path: ["size"],
        message: `Ukuran berkas maksimal ${maxBytes / 1024 / 1024} MB`,
      });
    }
  });

export type PresignFileInput = z.infer<typeof presignFileSchema>;
