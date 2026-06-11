import { z } from "zod";

const moneySchema = z.coerce.number().nonnegative();

export const createCategorySchema = z.object({
  name: z.string().min(2).max(80),
});

export const createProductSchema = z.object({
  name: z.string().min(2).max(120),
  sku: z.string().min(2).max(60),
  unit: z.string().min(1).max(30),
  purchasePrice: moneySchema,
  sellingPrice: moneySchema,
  stockQuantity: z.coerce.number().int().min(0).default(0),
  minimumStock: z.coerce.number().int().min(0).default(0),
  categoryId: z.string().uuid().optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const productQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  stockStatus: z.enum(["SAFE", "LOW", "OUT"]).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductQueryInput = z.infer<typeof productQuerySchema>;
