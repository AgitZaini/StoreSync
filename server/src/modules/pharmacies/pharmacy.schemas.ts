import { PharmacyStatus } from "@prisma/client";
import { z } from "zod";
import { phoneSchema, timeSchema } from "../../utils/schemas";
import { passwordSchema } from "../auth/auth.schemas";

const OUTSIDE_INDONESIA = "Titik lokasi harus berada di Indonesia";

export const pharmacyFieldsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  address: z.string().trim().min(5).max(300),
  latitude: z.number().min(-11.5, OUTSIDE_INDONESIA).max(6.5, OUTSIDE_INDONESIA),
  longitude: z.number().min(94.5, OUTSIDE_INDONESIA).max(141.5, OUTSIDE_INDONESIA),
  radiusM: z.number().int().min(10, "Radius minimal 10 m").max(500, "Radius maksimal 500 m"),
  is24h: z.boolean(),
  openTime: timeSchema.nullable(),
  closeTime: timeSchema.nullable(),
  /** Nomor HP untuk login akun Kasir Apotek. */
  kasirPhone: phoneSchema,
});

type OpeningHours = { is24h: boolean; openTime: string | null; closeTime: string | null };

/** Apotek yang tidak buka 24 jam wajib punya jam buka dan tutup. */
export const validateOpeningHours = (hours: OpeningHours) =>
  hours.is24h || (hours.openTime !== null && hours.closeTime !== null && hours.openTime !== hours.closeTime);

export const OPENING_HOURS_MESSAGE = "Isi jam buka dan jam tutup yang berbeda, atau tandai buka 24 jam";

export const createPharmacySchema = pharmacyFieldsSchema
  .extend({
    radiusM: pharmacyFieldsSchema.shape.radiusM.default(20),
    is24h: z.boolean().default(false),
    openTime: timeSchema.nullable().default(null),
    closeTime: timeSchema.nullable().default(null),
    kasirPassword: passwordSchema,
  })
  .refine(validateOpeningHours, { path: ["openTime"], message: OPENING_HOURS_MESSAGE });

export const updatePharmacySchema = pharmacyFieldsSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Tidak ada perubahan");

export const updatePharmacyStatusSchema = z.object({
  status: z.enum([PharmacyStatus.ACTIVE, PharmacyStatus.INACTIVE]),
});

export const listPharmaciesQuerySchema = z.object({
  status: z.nativeEnum(PharmacyStatus).optional(),
  q: z.string().trim().max(120).optional(),
});

export type CreatePharmacyInput = z.infer<typeof createPharmacySchema>;
export type UpdatePharmacyInput = z.infer<typeof updatePharmacySchema>;
export type UpdatePharmacyStatusInput = z.infer<typeof updatePharmacyStatusSchema>;
export type ListPharmaciesQuery = z.infer<typeof listPharmaciesQuerySchema>;
