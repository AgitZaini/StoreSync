import { z } from "zod";
import { normalizePhone } from "./phone";

export const idSchema = z.string().uuid("ID tidak valid");

/** Nomor HP Indonesia, dinormalkan ke 62xxxxxxxxxx. */
export const phoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizePhone(value);

  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Nomor HP tidak valid" });
    return z.NEVER;
  }

  return phone;
});

/** Bulan dalam format YYYY-MM. */
export const monthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM");

/** Tanggal dalam format YYYY-MM-DD (tanggal bisnis WIB). */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

/** Jam dalam format HH:mm (WIB). */
export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format jam harus HH:mm");

/** Nominal rupiah tanpa desimal. */
export const rupiahSchema = z.number().int("Nominal harus bilangan bulat").min(0).max(1_000_000_000_000);

/** Query string boolean ("true"/"false"). */
export const queryBooleanSchema = z.enum(["true", "false"]).transform((value) => value === "true");
