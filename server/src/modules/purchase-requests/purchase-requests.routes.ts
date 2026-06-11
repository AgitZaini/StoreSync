import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import {
  createPurchaseRequestSchema,
  ownerDecisionSchema,
  realizePurchaseRequestSchema,
} from "./purchase-request.schemas";
import * as purchaseRequestsController from "./purchase-requests.controller";

export const purchaseRequestsRouter = Router();

purchaseRequestsRouter.use(authenticate);

purchaseRequestsRouter.get("/", authorize(UserRole.OWNER, UserRole.SUPERVISOR), purchaseRequestsController.listPurchaseRequests);
purchaseRequestsRouter.post(
  "/",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR),
  validateBody(createPurchaseRequestSchema),
  purchaseRequestsController.createPurchaseRequest,
);
purchaseRequestsRouter.get(
  "/:id",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR),
  purchaseRequestsController.getPurchaseRequest,
);
purchaseRequestsRouter.post(
  "/:id/approve",
  authorize(UserRole.OWNER),
  validateBody(ownerDecisionSchema),
  purchaseRequestsController.approvePurchaseRequest,
);
purchaseRequestsRouter.post(
  "/:id/reject",
  authorize(UserRole.OWNER),
  validateBody(ownerDecisionSchema),
  purchaseRequestsController.rejectPurchaseRequest,
);
purchaseRequestsRouter.post(
  "/:id/request-revision",
  authorize(UserRole.OWNER),
  validateBody(ownerDecisionSchema),
  purchaseRequestsController.requestRevision,
);
purchaseRequestsRouter.post(
  "/:id/realize",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR),
  validateBody(realizePurchaseRequestSchema),
  purchaseRequestsController.realizePurchaseRequest,
);
