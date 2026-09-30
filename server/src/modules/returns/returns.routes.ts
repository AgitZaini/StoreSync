import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import {
  createReturnSchema,
  kasirApproveReturnSchema,
  kasirRejectReturnSchema,
  receiveReturnSchema,
  saApproveReturnSchema,
  saRejectReturnSchema,
} from "./return.schemas";
import * as returnsController from "./returns.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG, KASIR } = UserRole;

export const returnsRouter = Router();

returnsRouter.use(authenticate);

returnsRouter.get("/", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG, KASIR), returnsController.listReturns);
returnsRouter.get("/:id", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG, KASIR), returnsController.getReturn);

// RTR-01 SPG → RTR-02 kasir (nama + foto) → RTR-03 Super Admin → RTR-04 Admin menerima di gudang pusat (AB-08).
returnsRouter.post("/", authorize(SPG), validateBody(createReturnSchema), returnsController.createReturn);
returnsRouter.post("/:id/kasir-approve", authorize(KASIR), validateBody(kasirApproveReturnSchema), returnsController.kasirApprove);
returnsRouter.post("/:id/kasir-reject", authorize(KASIR), validateBody(kasirRejectReturnSchema), returnsController.kasirReject);
returnsRouter.post("/:id/approve", authorize(SUPER_ADMIN), validateBody(saApproveReturnSchema), returnsController.saApprove);
returnsRouter.post("/:id/reject", authorize(SUPER_ADMIN), validateBody(saRejectReturnSchema), returnsController.saReject);
returnsRouter.post("/:id/receive", authorize(ADMIN), validateBody(receiveReturnSchema), returnsController.receiveReturn);
