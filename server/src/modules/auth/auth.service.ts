import { Prisma, UserStatus } from "@prisma/client";
import type { User } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { recordAudit } from "../../utils/audit";
import type { AuditContext } from "../../utils/audit";
import { hashPassword, verifyPassword } from "../../utils/password";
import { normalizePhone } from "../../utils/phone";
import { prisma } from "../../utils/prisma";
import { publicUserSelect } from "../users/user.select";
import type { ChangePasswordInput, LoginInput, RefreshTokenInput } from "./auth.schemas";
import {
  createRefreshToken,
  getRefreshTokenExpiry,
  hashToken,
  isRefreshTokenIdle,
  signAccessToken,
} from "./token.service";

const INVALID_CREDENTIALS = "Nomor HP atau kata sandi salah";
const INACTIVE_ACCOUNT = "Akun tidak aktif. Hubungi Super Admin.";

const toPublicUser = ({ passwordHash: _passwordHash, passwordChangedAt: _passwordChangedAt, ...user }: User) => user;

const issueTokenPair = async (db: Prisma.TransactionClient, user: User) => {
  const accessToken = signAccessToken({
    sub: user.id,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  });
  const refreshToken = createRefreshToken();

  await db.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return { accessToken, refreshToken };
};

export const login = async (input: LoginInput, context: AuditContext) => {
  const phone = normalizePhone(input.phone);
  const user = phone ? await prisma.user.findUnique({ where: { phone } }) : null;

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, INVALID_CREDENTIALS);
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw new AppError(403, INACTIVE_ACCOUNT);
  }

  return prisma.$transaction(async (tx) => {
    const loggedInUser = await tx.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await issueTokenPair(tx, loggedInUser);

    await recordAudit(tx, {
      actor: loggedInUser,
      action: "auth.login",
      entity: "User",
      entityId: loggedInUser.id,
      context,
    });

    return { user: toPublicUser(loggedInUser), ...tokens };
  });
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AppError(401, "Akun sudah tidak tersedia");
  }

  return user;
};

export const refresh = async (input: RefreshTokenInput) => {
  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(input.refreshToken) },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
    throw new AppError(401, "Sesi tidak valid. Silakan masuk lagi.", "SESSION_INVALID");
  }

  if (isRefreshTokenIdle(storedToken.lastUsedAt)) {
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    });
    throw new AppError(401, "Sesi berakhir karena tidak aktif. Silakan masuk lagi.", "SESSION_IDLE");
  }

  if (storedToken.user.status !== UserStatus.ACTIVE) {
    throw new AppError(403, INACTIVE_ACCOUNT);
  }

  return prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({
      where: { id: storedToken.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Dua refresh bersamaan dengan token yang sama: hanya yang pertama boleh berhasil.
    if (revoked.count === 0) {
      throw new AppError(401, "Sesi tidak valid. Silakan masuk lagi.", "SESSION_INVALID");
    }

    const tokens = await issueTokenPair(tx, storedToken.user);
    return { user: toPublicUser(storedToken.user), ...tokens };
  });
};

export const changePassword = async (userId: string, input: ChangePasswordInput, context: AuditContext) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user || user.status !== UserStatus.ACTIVE) {
    throw new AppError(401, "Akun sudah tidak tersedia");
  }

  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    throw new AppError(400, "Kata sandi saat ini salah");
  }

  if (input.currentPassword === input.newPassword) {
    throw new AppError(400, "Kata sandi baru harus berbeda dari kata sandi saat ini");
  }

  const passwordHash = await hashPassword(input.newPassword);

  return prisma.$transaction(async (tx) => {
    const updatedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    // Sesi lain milik pengguna ini ikut berakhir.
    await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const tokens = await issueTokenPair(tx, updatedUser);

    await recordAudit(tx, {
      actor: updatedUser,
      action: "auth.change_password",
      entity: "User",
      entityId: updatedUser.id,
      before: { mustChangePassword: user.mustChangePassword },
      after: { mustChangePassword: false },
      context,
    });

    return { user: toPublicUser(updatedUser), ...tokens };
  });
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
