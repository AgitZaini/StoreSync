import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import * as inventoryController from "./inventory.controller";
import { adjustStockSchema } from "./inventory.schemas";

export const inventoryRouter = Router();

inventoryRouter.use(authenticate);

inventoryRouter.get("/mutations", authorize(UserRole.OWNER, UserRole.SUPERVISOR), inventoryController.listMutations);
inventoryRouter.post(
  "/products/:productId/adjust",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR),
  validateBody(adjustStockSchema),
  inventoryController.adjustStock,
);
