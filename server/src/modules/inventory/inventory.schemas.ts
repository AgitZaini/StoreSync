import { z } from "zod";

export const adjustStockSchema = z.object({
  quantity: z.coerce.number().int().min(0),
  note: z.string().max(240).optional(),
});

export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
