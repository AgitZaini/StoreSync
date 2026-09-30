import { WarehouseMovementType } from "@prisma/client";
import { z } from "zod";
import { dateSchema, idSchema } from "../../utils/schemas";

export const qtySchema = z.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(100_000);

const uniqueProducts = (items: Array<{ productId: string }>) => new Set(items.map((item) => item.productId)).size === items.length;

export const inboundSchema = z.object({
  /** Tanggal barang masuk (WIB); tidak boleh di masa depan. */
  date: dateSchema,
  poNumber: z.string().trim().max(60).optional(),
  note: z.string().trim().max(300).optional(),
  items: z
    .array(z.object({ productId: idSchema, qty: qtySchema }))
    .min(1, "Isi minimal satu produk")
    .max(100)
    .refine(uniqueProducts, "Ada produk yang dimasukkan lebih dari sekali"),
});

export const adjustmentSchema = z.object({
  productId: idSchema,
  /** Positif menambah, negatif mengurangi. */
  qty: z
    .number()
    .int("Jumlah harus bilangan bulat")
    .min(-100_000)
    .max(100_000)
    .refine((qty) => qty !== 0, "Jumlah penyesuaian tidak boleh 0"),
  reason: z.string().trim().min(5, "Alasan wajib diisi (minimal 5 karakter)").max(300),
});

export const movementsQuerySchema = z.object({
  productId: idSchema.optional(),
  type: z.nativeEnum(WarehouseMovementType).optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export type InboundInput = z.infer<typeof inboundSchema>;
export type AdjustmentInput = z.infer<typeof adjustmentSchema>;
export type MovementsQuery = z.infer<typeof movementsQuerySchema>;
