import { AppError } from "../../middleware/error-handler";
import { hashPassword } from "../../utils/password";
import { prisma } from "../../utils/prisma";
import type { CreateUserInput, UpdateUserStatusInput } from "./user.schemas";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

export const listUsers = () =>
  prisma.user.findMany({
    select: publicUserSelect,
    orderBy: { createdAt: "asc" },
  });

export const createUser = async (input: CreateUserInput) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (existingUser) {
    throw new AppError(409, "Email is already registered");
  }

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash: await hashPassword(input.password),
      role: input.role,
    },
    select: publicUserSelect,
  });
};

export const updateUserStatus = async (userId: string, input: UpdateUserStatusInput) =>
  prisma.user.update({
    where: { id: userId },
    data: { status: input.status },
    select: publicUserSelect,
  });
