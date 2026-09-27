import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../../config/env";

export type AccessTokenPayload = {
  sub: string;
  role: UserRole;
  mustChangePassword: boolean;
};

export const signAccessToken = (payload: AccessTokenPayload) =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: "15m",
  });

export const verifyAccessToken = (token: string) =>
  jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

export const createRefreshToken = () => crypto.randomBytes(48).toString("base64url");

export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export const getRefreshTokenExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return expiresAt;
};

export const isRefreshTokenIdle = (lastUsedAt: Date, now = new Date()) =>
  now.getTime() - lastUsedAt.getTime() > env.SESSION_IDLE_MINUTES * 60 * 1000;
