import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createDepositSchema } from "./deposit.schemas";
import * as depositsController from "./deposits.controller";

export const depositsRouter = Router();

depositsRouter.use(authenticate);
depositsRouter.use(authorize(UserRole.OWNER, UserRole.SUPERVISOR));

depositsRouter.get("/", depositsController.listDeposits);
depositsRouter.post("/", validateBody(createDepositSchema), depositsController.createDeposit);
