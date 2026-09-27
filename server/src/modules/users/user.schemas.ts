import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";
import { normalizePhone } from "../../utils/phone";
import { passwordSchema } from "../auth/auth.schemas";

export const phoneSchema = z.string().transform((value, ctx) => {
  const phone = normalizePhone(value);

  if (!phone) {
    ctx.addIssue({ code: "custom", message: "Nomor HP tidak valid" });
    return z.NEVER;
  }

  return phone;
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: phoneSchema,
  password: passwordSchema,
  role: z.nativeEnum(UserRole),
});

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
