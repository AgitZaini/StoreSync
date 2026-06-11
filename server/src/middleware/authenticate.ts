import type { RequestHandler } from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { AppError } from "./error-handler";
import { verifyAccessToken } from "../modules/auth/token.service";

export const authenticate: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new AppError(401, "Missing bearer token"));
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      next(new AppError(401, "Access token expired"));
      return;
    }

    if (error instanceof JsonWebTokenError) {
      next(new AppError(401, "Invalid access token"));
      return;
    }

    next(error);
  }
};
