import { z } from "zod";

const booleanFromString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  // Refresh token ditolak bila tidak dipakai selama ini. Akses token berlaku 15 menit,
  // jadi nilai ini sebaiknya = batas idle di client + 15 menit.
  SESSION_IDLE_MINUTES: z.coerce.number().int().positive().default(45),
  LOGIN_RATE_LIMIT_PER_15_MIN: z.coerce.number().int().positive().default(20),
  // Penyimpanan berkas S3-compatible: Cloudflare R2 di produksi, MinIO di lokal.
  S3_ENDPOINT: z.string().url().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: booleanFromString,
});

export const env = envSchema.parse(process.env);
