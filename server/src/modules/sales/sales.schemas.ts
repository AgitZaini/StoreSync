import { PaymentMethod } from "@prisma/client";
import { z } from "zod";

export const createSalesTransactionSchema = z.object({
  customerName: z.string().max(120).optional(),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  transactionAt: z.coerce.date().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
      }),
    )
    .min(1),
});

export const salesTransactionQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  salesId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

export type CreateSalesTransactionInput = z.infer<typeof createSalesTransactionSchema>;
export type SalesTransactionQueryInput = z.infer<typeof salesTransactionQuerySchema>;
