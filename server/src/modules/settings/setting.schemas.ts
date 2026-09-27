import { z } from "zod";
import { rupiahSchema } from "../../utils/schemas";

export const updateLeaveQuotaSchema = z.object({
  days: z.number().int().min(0).max(60),
});

export const createDeductionRateSchema = z.object({
  amountPerDay: rupiahSchema,
});

export type UpdateLeaveQuotaInput = z.infer<typeof updateLeaveQuotaSchema>;
export type CreateDeductionRateInput = z.infer<typeof createDeductionRateSchema>;
