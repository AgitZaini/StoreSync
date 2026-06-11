import { z } from "zod";

export const createOperationalExpenseSchema = z.object({
  title: z.string().min(2).max(120),
  amount: z.coerce.number().positive(),
  category: z.string().max(80).optional(),
  note: z.string().max(300).optional(),
  expenseAt: z.coerce.date().default(() => new Date()),
});

export const financeSummaryQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateOperationalExpenseInput = z.infer<typeof createOperationalExpenseSchema>;
export type FinanceSummaryQueryInput = z.infer<typeof financeSummaryQuerySchema>;
