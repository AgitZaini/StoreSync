import { UserStatus } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { verifyPassword } from "../../utils/password";
import { prisma } from "../../utils/prisma";
import type { LoginInput, RefreshTokenInput } from "./auth.schemas";
import { createRefreshToken, getRefreshTokenExpiry, hashToken, signAccessToken } from "./token.service";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const issueTokenPair = async (user: { id: string; email: string; role: import("@prisma/client").UserRole }) => {
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });
  const refreshToken = createRefreshToken();

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase() },
  });

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, "Invalid email or password");
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(403, "User account is inactive");
  }

  const tokens = await issueTokenPair(user);
  const { passwordHash: _passwordHash, ...safeUser } = user;

  return {
    user: safeUser,
    ...tokens,
  };
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AppError(401, "Authenticated user is no longer available");
  }

  return user;
};

export const refresh = async (input: RefreshTokenInput) => {
  const tokenHash = hashToken(input.refreshToken);
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
    throw new AppError(401, "Invalid refresh token");
  }

  if (storedToken.user.status !== UserStatus.ACTIVE) {
    throw new AppError(403, "User account is inactive");
  }

  await prisma.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokenPair(storedToken.user);
  const { passwordHash: _passwordHash, ...safeUser } = storedToken.user;

  return {
    user: safeUser,
    ...tokens,
  };
};

export const logout = async (refreshToken: string) => {
  await prisma.refreshToken.updateMany({
    where: {
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};
