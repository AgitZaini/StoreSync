import { z } from "zod";
import { idSchema, monthSchema, rupiahSchema } from "../../utils/schemas";

export const listTargetsQuerySchema = z.object({
  month: monthSchema,
});

export const upsertTargetsSchema = z.object({
  targets: z
    .array(
      z.object({
        spgId: idSchema,
        /** null menghapus target SPG pada bulan itu. */
        amount: rupiahSchema.nullable(),
      }),
    )
    .min(1)
    .max(500)
    .refine((items) => new Set(items.map((item) => item.spgId)).size === items.length, "SPG tidak boleh ganda"),
});

export type UpsertTargetsInput = z.infer<typeof upsertTargetsSchema>;
