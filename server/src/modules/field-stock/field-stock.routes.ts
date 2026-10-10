import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { openingStockSchema } from "./field-stock.schemas";
import * as fieldStockController from "./field-stock.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG } = UserRole;

export const fieldStockRouter = Router();

fieldStockRouter.use(authenticate);

// AB-05: sisa stok per SPG per apotek. Kasir tidak melihat stok SPG.
fieldStockRouter.get("/", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), fieldStockController.listFieldStock);
fieldStockRouter.get("/available", authorize(SPG), fieldStockController.listAvailableStock);
fieldStockRouter.get("/movements", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), fieldStockController.listMovements);
fieldStockRouter.put("/opening", authorize(ADMIN), validateBody(openingStockSchema), fieldStockController.setOpeningStock);
