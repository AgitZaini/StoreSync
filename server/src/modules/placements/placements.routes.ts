import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createPlacementSchema, endPlacementSchema } from "./placement.schemas";
import * as placementsController from "./placements.controller";

export const placementsRouter = Router();

placementsRouter.use(authenticate);

placementsRouter.get("/", placementsController.listPlacements);
placementsRouter.post("/", authorize(UserRole.SUPER_ADMIN), validateBody(createPlacementSchema), placementsController.createPlacement);
placementsRouter.post(
  "/:id/end",
  authorize(UserRole.SUPER_ADMIN),
  validateBody(endPlacementSchema),
  placementsController.endPlacement,
);
