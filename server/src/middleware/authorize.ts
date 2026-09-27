import type { UserRole } from "@prisma/client";
import type { RequestHandler } from "express";
import { AppError } from "./error-handler";

export const authorize =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, "Silakan masuk terlebih dahulu"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "Anda tidak punya akses ke data ini"));
      return;
    }

    next();
  };
