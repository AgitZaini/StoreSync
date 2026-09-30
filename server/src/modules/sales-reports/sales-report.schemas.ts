import { SalesReportStatus } from "@prisma/client";
import { z } from "zod";
import { dateSchema, idSchema, monthSchema } from "../../utils/schemas";
import { cashierIdentitySchema, cashierRejectSchema } from "../approvals/cashier-approval";
import { qtySchema } from "../warehouse/warehouse.schemas";

const itemsSchema = z
  .array(z.object({ productId: idSchema, qty: qtySchema }))
  .min(1, "Isi minimal satu produk yang terjual")
  .max(100)
  .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, "Ada produk yang diisi lebih dari sekali");

export const createSalesReportSchema = z.object({
  pharmacyId: idSchema,
  /** Tanggal penjualan (WIB); bawaan hari ini, boleh kemarin bila terlambat melapor. */
  reportDate: dateSchema.optional(),
  note: z.string().trim().max(300).optional(),
  items: itemsSchema,
});

export const updateSalesReportSchema = z.object({
  note: z.string().trim().max(300).optional(),
  items: itemsSchema,
});

/** Kasir menyetujui revisi yang sedang ia lihat; bila SPG sudah mengubahnya, keputusan ditolak. */
export const approveSalesReportSchema = cashierIdentitySchema.extend({ revision: z.number().int().min(1) });
export const rejectSalesReportSchema = cashierRejectSchema.extend({ revision: z.number().int().min(1) });

export const listSalesReportsQuerySchema = z.object({
  status: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.array(z.nativeEnum(SalesReportStatus)))
    .optional(),
  spgId: idSchema.optional(),
  pharmacyId: idSchema.optional(),
  from: dateSchema.optional(),
  to: dateSchema.optional(),
});

export const pendingQuerySchema = z.object({
  olderThanDays: z.coerce.number().int().min(0).max(60).default(1),
});

export const performanceQuerySchema = z.object({
  month: monthSchema,
  spgId: idSchema.optional(),
});

export type CreateSalesReportInput = z.infer<typeof createSalesReportSchema>;
export type UpdateSalesReportInput = z.infer<typeof updateSalesReportSchema>;
export type ApproveSalesReportInput = z.infer<typeof approveSalesReportSchema>;
export type RejectSalesReportInput = z.infer<typeof rejectSalesReportSchema>;
export type ListSalesReportsQuery = z.infer<typeof listSalesReportsQuerySchema>;
