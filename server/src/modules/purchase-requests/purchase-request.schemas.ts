import { z } from "zod";

export const createPurchaseRequestSchema = z.object({
  supplier: z.string().max(120).optional(),
  note: z.string().max(500).optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.coerce.number().int().positive(),
        estimatedPrice: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
});

export const ownerDecisionSchema = z.object({
  note: z.string().max(500).optional(),
});

export const realizePurchaseRequestSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        actualPrice: z.coerce.number().nonnegative(),
      }),
    )
    .min(1),
  note: z.string().max(500).optional(),
});

export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestSchema>;
export type OwnerDecisionInput = z.infer<typeof ownerDecisionSchema>;
export type RealizePurchaseRequestInput = z.infer<typeof realizePurchaseRequestSchema>;
