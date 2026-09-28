import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { idSchema, phoneSchema } from "../../utils/schemas";
import { passwordSchema } from "../auth/auth.schemas";

// Akun kasir dibuat otomatis bersama apoteknya (AKN-03), bukan dari menu pengguna.
const assignableRoleSchema = z
  .nativeEnum(UserRole)
  .refine((role) => role !== UserRole.KASIR, "Akun kasir dibuat otomatis saat mendaftarkan apotek");

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  password: passwordSchema,
  role: assignableRoleSchema,
  teamId: idSchema.nullish(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    phone: phoneSchema,
    role: assignableRoleSchema,
  })
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Tidak ada perubahan");

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const updateUserTeamSchema = z.object({
  teamId: idSchema.nullable(),
});

export const listUsersQuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  teamId: idSchema.optional(),
  q: z.string().trim().max(120).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateUserTeamInput = z.infer<typeof updateUserTeamSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
