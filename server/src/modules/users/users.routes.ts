import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  updateUserStatusSchema,
  updateUserTeamSchema,
} from "./user.schemas";
import * as usersController from "./users.controller";

export const usersRouter = Router();

usersRouter.use(authenticate);

// Admin boleh melihat daftar pengguna (untuk jadwal & pemantauan); BR-01: hanya Super Admin yang mengubah.
usersRouter.get("/", authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), usersController.listUsers);
usersRouter.get("/:id", authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), usersController.getUser);

usersRouter.use(authorize(UserRole.SUPER_ADMIN));

usersRouter.post("/", validateBody(createUserSchema), usersController.createUser);
usersRouter.patch("/:id", validateBody(updateUserSchema), usersController.updateUser);
usersRouter.patch("/:id/status", validateBody(updateUserStatusSchema), usersController.updateUserStatus);
usersRouter.post("/:id/reset-password", validateBody(resetPasswordSchema), usersController.resetPassword);
usersRouter.patch("/:id/team", validateBody(updateUserTeamSchema), usersController.updateUserTeam);
