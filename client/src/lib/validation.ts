import { z } from "zod";

export const phoneField = z
  .string()
  .trim()
  .min(1, "Nomor HP wajib diisi")
  .refine((value) => value.replace(/\D/g, "").length >= 9, "Nomor HP tidak valid");

// Sama dengan aturan di server (auth.schemas.ts).
export const passwordRules = [
  { label: "Minimal 8 karakter", test: (value: string) => value.length >= 8 },
  { label: "Mengandung huruf", test: (value: string) => /[A-Za-z]/.test(value) },
  { label: "Mengandung angka", test: (value: string) => /\d/.test(value) },
];

export const newPasswordField = z
  .string()
  .max(72, "Kata sandi maksimal 72 karakter")
  .refine((value) => passwordRules.every((rule) => rule.test(value)), "Minimal 8 karakter, berisi huruf dan angka");
