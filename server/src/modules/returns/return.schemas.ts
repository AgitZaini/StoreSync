import { ReturnStatus } from "@prisma/client";
import { z } from "zod";
import { idSchema, queryBooleanSchema } from "../../utils/schemas";
import { cashierIdentitySchema, cashierRejectSchema } from "../approvals/cashier-approval";
import { qtySchema } from "../warehouse/warehouse.schemas";

export const createReturnSchema = z.object({
  pharmacyId: idSchema,
  reason: z.string().trim().min(5, "Jelaskan alasan retur (minimal 5 karakter)").max(300),
  /** Foto barang (opsional, RTR-01). */
  photoFileId: idSchema.optional(),
  items: z
    .array(z.object({ productId: idSchema, qty: qtySchema }))
    .min(1, "Pilih minimal satu produk")
    .max(50)
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, "Ada produk yang dipilih lebih dari sekali"),
});

export const kasirApproveReturnSchema = cashierIdentitySchema;
export const kasirRejectReturnSchema = cashierRejectSchema;

export const saApproveReturnSchema = z.object({ note: z.string().trim().max(300).optional() });
export const saRejectReturnSchema = z.object({ reason: z.string().trim().min(3, "Alasan penolakan wajib diisi").max(300) });

export const receiveReturnSchema = z.object({
  items: z
    .array(z.object({ itemId: idSchema, qty: z.number().int().min(0).max(100_000) }))
    .max(50)
    .refine((items) => new Set(items.map((item) => item.itemId)).size === items.length, "Ada item yang dikirim lebih dari sekali")
    .optional(),
  /** Wajib bila jumlah diterima berbeda dari yang disetujui. */
  note: z.string().trim().max(300).optional(),
});

export const listReturnsQuerySchema = z.object({
  status: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.array(z.nativeEnum(ReturnStatus)))
    .optional(),
  spgId: idSchema.optional(),
  pharmacyId: idSchema.optional(),
  discrepancy: queryBooleanSchema.optional(),
});

export type CreateReturnInput = z.infer<typeof createReturnSchema>;
export type ReceiveReturnInput = z.infer<typeof receiveReturnSchema>;
export type ListReturnsQuery = z.infer<typeof listReturnsQuerySchema>;
