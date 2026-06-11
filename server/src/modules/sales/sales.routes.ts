import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import * as salesController from "./sales.controller";
import { createSalesTransactionSchema } from "./sales.schemas";

export const salesRouter = Router();

salesRouter.use(authenticate);

salesRouter.get("/", salesController.listSalesTransactions);
salesRouter.post(
  "/",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR, UserRole.SALES),
  validateBody(createSalesTransactionSchema),
  salesController.createSalesTransaction,
);
salesRouter.get("/:id", salesController.getSalesTransaction);
