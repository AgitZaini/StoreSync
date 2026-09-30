import { z } from "zod";
import { idSchema } from "../../utils/schemas";

export const fieldStockQuerySchema = z.object({
  holderId: idSchema.optional(),
  pharmacyId: idSchema.optional(),
});

export const fieldMovementsQuerySchema = z.object({
  holderId: idSchema,
  pharmacyId: idSchema,
  productId: idSchema.optional(),
});

export const openingStockSchema = z.object({
  spgId: idSchema,
  pharmacyId: idSchema,
  /** Jumlah stok awal per produk; produk yang tidak disebut tidak berubah. */
  items: z
    .array(z.object({ productId: idSchema, qty: z.number().int("Jumlah harus bilangan bulat").min(0).max(100_000) }))
    .min(1, "Isi minimal satu produk")
    .max(200)
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, "Ada produk yang diisi lebih dari sekali"),
});

export type FieldStockQuery = z.infer<typeof fieldStockQuerySchema>;
export type FieldMovementsQuery = z.infer<typeof fieldMovementsQuerySchema>;
export type OpeningStockInput = z.infer<typeof openingStockSchema>;
