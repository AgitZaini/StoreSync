import { z } from "zod";
import { dateSchema } from "../../utils/schemas";

export const pingSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** Akurasi GPS (meter) dari perangkat. */
  accuracyM: z.number().min(0).max(100_000),
});

export const locationDateQuerySchema = z.object({
  date: dateSchema.optional(),
});

export type PingInput = z.infer<typeof pingSchema>;
