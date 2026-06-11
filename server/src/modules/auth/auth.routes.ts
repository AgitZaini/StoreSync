import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate-request";
import * as authController from "./auth.controller";
import { loginSchema, refreshTokenSchema } from "./auth.schemas";

export const authRouter = Router();

authRouter.post("/login", validateBody(loginSchema), authController.login);
authRouter.get("/me", authenticate, authController.me);
authRouter.post("/refresh", validateBody(refreshTokenSchema), authController.refresh);
authRouter.post("/logout", validateBody(refreshTokenSchema), authController.logout);
