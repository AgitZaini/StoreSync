import type { RequestHandler } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { AppError } from "./error-handler";
import { verifyAccessToken } from "../modules/auth/token.service";

const authenticateRequest =
  ({ allowPendingPasswordChange }: { allowPendingPasswordChange: boolean }): RequestHandler =>
  (req, _res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      next(new AppError(401, "Silakan masuk terlebih dahulu"));
      return;
    }

    const token = authHeader.slice("Bearer ".length);

    try {
      const payload = verifyAccessToken(token);

      if (payload.mustChangePassword && !allowPendingPasswordChange) {
        next(new AppError(403, "Ganti kata sandi terlebih dahulu", "PASSWORD_CHANGE_REQUIRED"));
        return;
      }

      req.user = {
        id: payload.sub,
        role: payload.role,
        mustChangePassword: payload.mustChangePassword,
      };
      next();
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        next(new AppError(401, "Access token kedaluwarsa", "ACCESS_TOKEN_EXPIRED"));
        return;
      }

      if (error instanceof JsonWebTokenError) {
        next(new AppError(401, "Access token tidak valid"));
        return;
      }

      next(error);
    }
  };

export const authenticate = authenticateRequest({ allowPendingPasswordChange: false });

/** Untuk endpoint yang tetap boleh dipakai sebelum pengguna mengganti kata sandi pertamanya. */
export const authenticateAllowingPasswordChange = authenticateRequest({ allowPendingPasswordChange: true });
