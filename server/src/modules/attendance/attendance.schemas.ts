import { AttendanceExceptionStatus, AttendanceKind } from "@prisma/client";
import { z } from "zod";
import { dateSchema, idSchema } from "../../utils/schemas";

/** Hasil verifikasi wajah di perangkat (deteksi satu wajah + kedip). */
export const faceCheckSchema = z.object({
  passed: z.boolean(),
  method: z.string().max(40),
  faces: z.number().int().min(0).max(10).optional(),
  blinkDetected: z.boolean().optional(),
  durationMs: z.number().int().min(0).max(600_000).optional(),
  failureReason: z.string().max(200).optional(),
});

const attendanceFields = {
  pharmacyId: idSchema,
  kind: z.nativeEnum(AttendanceKind),
  photoFileId: idSchema,
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Akurasi GPS (meter) dari perangkat. */
  accuracyM: z.number().min(0).max(100_000),
  faceCheck: faceCheckSchema,
};

export const createAttendanceSchema = z.object(attendanceFields);

export const createAttendanceExceptionSchema = z.object({
  ...attendanceFields,
  reason: z.string().trim().min(5, "Jelaskan alasannya (minimal 5 karakter)").max(300),
});

export const reviewExceptionSchema = z.object({
  note: z.string().trim().max(300).optional(),
});

export const rejectExceptionSchema = z.object({
  note: z.string().trim().min(3, "Alasan penolakan wajib diisi").max(300),
});

export const monitorQuerySchema = z.object({
  date: dateSchema.optional(),
});

export const historyQuerySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    spgId: idSchema.optional(),
  })
  .refine((query) => query.from <= query.to, "Tanggal awal harus sebelum tanggal akhir");

export const saveNoteSchema = z.object({
  spgId: idSchema,
  pharmacyId: idSchema,
  date: dateSchema,
  /** Kosong menghapus catatan. */
  note: z.string().trim().max(500),
});

export const listExceptionsQuerySchema = z.object({
  status: z.nativeEnum(AttendanceExceptionStatus).optional(),
});

export type CreateAttendanceInput = z.infer<typeof createAttendanceSchema>;
export type CreateAttendanceExceptionInput = z.infer<typeof createAttendanceExceptionSchema>;
export type HistoryQuery = z.infer<typeof historyQuerySchema>;
export type SaveNoteInput = z.infer<typeof saveNoteSchema>;
