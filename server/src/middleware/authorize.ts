import type { UserRole } from "@prisma/client";
import type { RequestHandler } from "express";
import { AppError } from "./error-handler";

export const authorize =
  (...roles: UserRole[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) {
      next(new AppError(401, "Authentication is required"));
      return;
    }

    if (!roles.includes(req.user.role)) {
      next(new AppError(403, "You do not have access to this resource"));
      return;
    }

    next();
  };
