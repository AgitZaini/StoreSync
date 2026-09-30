import { OrderStatus } from "@prisma/client";
import { z } from "zod";
import { dateSchema, idSchema, queryBooleanSchema } from "../../utils/schemas";
import { qtySchema } from "../warehouse/warehouse.schemas";

const itemQty = z.number().int("Jumlah harus bilangan bulat").min(0).max(100_000);

const uniqueBy = <T>(key: (item: T) => string) => (items: T[]) => new Set(items.map(key)).size === items.length;

export const createOrderSchema = z.object({
  pharmacyId: idSchema,
  note: z.string().trim().max(300).optional(),
  items: z
    .array(z.object({ productId: idSchema, qty: qtySchema }))
    .min(1, "Pilih minimal satu produk")
    .max(50)
    .refine(uniqueBy((item: { productId: string }) => item.productId), "Ada produk yang dipilih lebih dari sekali"),
});

/** Jumlah per item; item yang tidak dikirim memakai nilai bawaan (diminta/disetujui/dikirim). */
const itemQuantities = z
  .array(z.object({ itemId: idSchema, qty: itemQty }))
  .max(50)
  .refine(uniqueBy((item: { itemId: string }) => item.itemId), "Ada item yang dikirim lebih dari sekali")
  .optional();

export const approveOrderSchema = z.object({
  items: itemQuantities,
  note: z.string().trim().max(300).optional(),
});

export const rejectOrderSchema = z.object({
  reason: z.string().trim().min(3, "Alasan penolakan wajib diisi").max(300),
});

export const shipOrderSchema = z.object({
  items: itemQuantities,
  note: z.string().trim().max(300).optional(),
});

export const receiveOrderSchema = z.object({
  items: itemQuantities,
  /** Wajib bila ada jumlah yang berbeda dari yang dikirim. */
  note: z.string().trim().max(300).optional(),
});

export const resolveDiscrepancySchema = z.object({
  note: z.string().trim().min(3, "Catatan tindak lanjut wajib diisi").max(300),
});

export const listOrdersQuerySchema = z.object({
  status: z
    .string()
    .transform((value) => value.split(","))
    .pipe(z.array(z.nativeEnum(OrderStatus)))
    .optional(),
  spgId: idSchema.optional(),
  pharmacyId: idSchema.optional(),
  /** true: hanya order dengan selisih penerimaan yang belum ditindaklanjuti. */
  openDiscrepancy: queryBooleanSchema.optional(),
});

export const recapQuerySchema = z
  .object({ from: dateSchema.optional(), to: dateSchema.optional() })
  .refine((query) => !query.from || !query.to || query.from <= query.to, "Tanggal awal harus sebelum tanggal akhir");

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ItemQuantities = z.infer<typeof itemQuantities>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type RecapQuery = z.infer<typeof recapQuerySchema>;
