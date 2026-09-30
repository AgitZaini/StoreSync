import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { adjustmentSchema, inboundSchema } from "./warehouse.schemas";
import * as warehouseController from "./warehouse.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG } = UserRole;

export const warehouseRouter = Router();

warehouseRouter.use(authenticate);

// ORD-01: SPG melihat stok pusat sebelum memesan. STK-01: hanya Admin yang mencatat mutasi.
warehouseRouter.get("/stock", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), warehouseController.listStock);
warehouseRouter.get("/movements", authorize(SUPER_ADMIN, ADMIN), warehouseController.listMovements);
warehouseRouter.post("/inbound", authorize(ADMIN), validateBody(inboundSchema), warehouseController.recordInbound);
warehouseRouter.post("/adjustments", authorize(ADMIN), validateBody(adjustmentSchema), warehouseController.adjustStock);
