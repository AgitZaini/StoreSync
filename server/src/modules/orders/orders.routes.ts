import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import {
  approveOrderSchema,
  createOrderSchema,
  receiveOrderSchema,
  rejectOrderSchema,
  resolveDiscrepancySchema,
  shipOrderSchema,
} from "./order.schemas";
import * as ordersController from "./orders.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG } = UserRole;

export const ordersRouter = Router();

ordersRouter.use(authenticate);

// ORD-05 didaftarkan sebelum "/:id" supaya tidak dianggap ID order.
ordersRouter.get("/unfulfilled-recap", authorize(SUPER_ADMIN, ADMIN), ordersController.unfulfilledRecap);
ordersRouter.get("/", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), ordersController.listOrders);
ordersRouter.get("/:id", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), ordersController.getOrder);

// ORD-01 SPG mengajukan → ORD-02 Super Admin memutuskan (AB-13) → ORD-03 Admin mengirim → ORD-04 SPG menerima.
ordersRouter.post("/", authorize(SPG), validateBody(createOrderSchema), ordersController.createOrder);
ordersRouter.post("/:id/approve", authorize(SUPER_ADMIN), validateBody(approveOrderSchema), ordersController.approveOrder);
ordersRouter.post("/:id/reject", authorize(SUPER_ADMIN), validateBody(rejectOrderSchema), ordersController.rejectOrder);
ordersRouter.post("/:id/ship", authorize(ADMIN), validateBody(shipOrderSchema), ordersController.shipOrder);
ordersRouter.post("/:id/receive", authorize(SPG), validateBody(receiveOrderSchema), ordersController.receiveOrder);
ordersRouter.post(
  "/:id/resolve-discrepancy",
  authorize(ADMIN),
  validateBody(resolveDiscrepancySchema),
  ordersController.resolveDiscrepancy,
);
