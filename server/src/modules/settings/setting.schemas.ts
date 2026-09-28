import { z } from "zod";
import { rupiahSchema } from "../../utils/schemas";

export const updateLeaveQuotaSchema = z.object({
  days: z.number().int().min(0).max(60),
});

export const createDeductionRateSchema = z.object({
  amountPerDay: rupiahSchema,
});

export const updateAttendanceSettingsSchema = z.object({
  maxAccuracyM: z.number().int().min(10).max(1000),
  lateToleranceMinutes: z.number().int().min(0).max(120),
});

export type UpdateAttendanceSettingsInput = z.infer<typeof updateAttendanceSettingsSchema>;
export type UpdateLeaveQuotaInput = z.infer<typeof updateLeaveQuotaSchema>;
export type CreateDeductionRateInput = z.infer<typeof createDeductionRateSchema>;
