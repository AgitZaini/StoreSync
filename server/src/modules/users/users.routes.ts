import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createUserSchema, updateUserStatusSchema } from "./user.schemas";
import * as usersController from "./users.controller";

export const usersRouter = Router();

// BR-01: hanya Super Admin yang membuat akun dan memberi peran.
usersRouter.use(authenticate);
usersRouter.use(authorize(UserRole.SUPER_ADMIN));

usersRouter.get("/", usersController.listUsers);
usersRouter.post("/", validateBody(createUserSchema), usersController.createUser);
usersRouter.patch("/:id/status", validateBody(updateUserStatusSchema), usersController.updateUserStatus);
