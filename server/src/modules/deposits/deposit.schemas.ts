import { z } from "zod";

export const createDepositSchema = z.object({
  amount: z.coerce.number().positive(),
  destination: z.string().min(2).max(120),
  note: z.string().max(300).optional(),
  depositedAt: z.coerce.date().default(() => new Date()),
});

export type CreateDepositInput = z.infer<typeof createDepositSchema>;
