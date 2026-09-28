import { z } from "zod";
import { dateSchema, idSchema } from "../../utils/schemas";
import { weekStartSchema } from "../schedules/schedule.schemas";

export const visitPlanQuerySchema = z.object({
  weekStart: weekStartSchema,
  /** Wajib untuk Super Admin/Admin; Team Leader selalu melihat rencananya sendiri. */
  leaderId: idSchema.optional(),
});

export const visitPlanSummaryQuerySchema = z.object({
  weekStart: weekStartSchema,
});

export const saveVisitPlanSchema = z.object({
  /** Hari yang dikirim diganti seluruhnya; hari yang tidak dikirim tidak berubah. */
  days: z
    .array(
      z.object({
        date: dateSchema,
        pharmacyIds: z.array(idSchema).max(30, "Maksimal 30 apotek per hari"),
      }),
    )
    .min(1)
    .max(7),
});

export const missReasonSchema = z.object({
  reason: z.string().trim().min(5, "Jelaskan alasannya (minimal 5 karakter)").max(500),
  /** Bukti opsional (mis. surat dokter). `null` melepas bukti; tidak dikirim berarti tetap. */
  evidenceFileId: idSchema.nullable().optional(),
});

export type SaveVisitPlanInput = z.infer<typeof saveVisitPlanSchema>;
export type MissReasonInput = z.infer<typeof missReasonSchema>;
