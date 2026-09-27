import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { upsertTargetsSchema } from "./target.schemas";
import * as targetsController from "./targets.controller";

export const targetsRouter = Router();

targetsRouter.use(authenticate);

targetsRouter.get(
  "/",
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.SPG),
  targetsController.listTargets,
);
targetsRouter.put("/:month", authorize(UserRole.SUPER_ADMIN), validateBody(upsertTargetsSchema), targetsController.upsertTargets);
