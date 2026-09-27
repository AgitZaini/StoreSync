import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createDeductionRateSchema, updateLeaveQuotaSchema } from "./setting.schemas";
import * as settingsController from "./settings.controller";

export const settingsRouter = Router();

settingsRouter.use(authenticate, authorize(UserRole.SUPER_ADMIN));

settingsRouter.get("/", settingsController.getSettings);
settingsRouter.put("/leave-quota", validateBody(updateLeaveQuotaSchema), settingsController.updateLeaveQuota);
settingsRouter.post("/deduction-rates", validateBody(createDeductionRateSchema), settingsController.addDeductionRate);
