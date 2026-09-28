import { UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditActor, AuditContext } from "../../utils/audit";
import { hashPassword } from "../../utils/password";
import { prisma } from "../../utils/prisma";
import type { CreateUserInput, UpdateUserStatusInput } from "./user.schemas";
import { publicUserSelect } from "./user.select";

export const listUsers = () =>
  prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { createdAt: "asc" },
  });

export const createUser = async (input: CreateUserInput, actor: AuditActor, context: AuditContext) => {
  const existingUser = await prisma.user.findUnique({ where: { phone: input.phone } });

  if (existingUser) {
    throw new AppError(409, "Nomor HP sudah terdaftar");
  }

  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        phone: input.phone,
        passwordHash,
        role: input.role,
        mustChangePassword: true,
      },
      select: publicUserSelect,
    });

    await recordAudit(tx, { actor, action: "user.create", entity: "User", entityId: user.id, after: user, context });

    return user;
  });
};

export const updateUserStatus = async (
  userId: string,
  input: UpdateUserStatusInput,
  actor: AuditActor,
  context: AuditContext,
) => {
  if (userId === actor.id) {
    throw new AppError(400, "Anda tidak bisa mengubah status akun sendiri");
  }

  const existingUser = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });

  if (!existingUser) {
    throw new AppError(404, "Pengguna tidak ditemukan");
  }

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id: userId },
      data: { status: input.status },
      select: publicUserSelect,
    });

    if (input.status === UserStatus.INACTIVE) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await recordAudit(tx, {
      actor,
      action: "user.update_status",
      entity: "User",
      entityId: userId,
      before: { status: existingUser.status },
      after: { status: user.status },
      context,
    });

    return user;
  });
};
