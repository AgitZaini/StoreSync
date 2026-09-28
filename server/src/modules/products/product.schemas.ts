import { z } from "zod";
import { queryBooleanSchema, rupiahSchema } from "../../utils/schemas";

export const createProductSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "Kode hanya boleh huruf, angka, titik, strip, atau garis bawah")
    .transform((code) => code.toUpperCase()),
  name: z.string().trim().min(2).max(160),
  unit: z.string().trim().min(1).max(30),
  price: rupiahSchema,
});

export const updateProductSchema = createProductSchema
  .extend({ isActive: z.boolean() })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Tidak ada perubahan");

export const listProductsQuerySchema = z.object({
  includeInactive: queryBooleanSchema.optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
