import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { env } from "../../config/env";
import { authenticateAllowingPasswordChange } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate-request";
import * as authController from "./auth.controller";
import { changePasswordSchema, loginSchema, refreshTokenSchema } from "./auth.schemas";

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.LOGIN_RATE_LIMIT_PER_15_MIN,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skip: () => env.NODE_ENV === "test",
  message: { status: "error", message: "Terlalu banyak percobaan masuk. Coba lagi dalam 15 menit." },
});

export const authRouter = Router();

authRouter.post("/login", loginLimiter, validateBody(loginSchema), authController.login);
authRouter.get("/me", authenticateAllowingPasswordChange, authController.me);
authRouter.post("/refresh", validateBody(refreshTokenSchema), authController.refresh);
authRouter.post(
  "/change-password",
  authenticateAllowingPasswordChange,
  validateBody(changePasswordSchema),
  authController.changePassword,
);
authRouter.post("/logout", validateBody(refreshTokenSchema), authController.logout);
