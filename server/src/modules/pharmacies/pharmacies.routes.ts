import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createPharmacySchema, updatePharmacySchema, updatePharmacyStatusSchema } from "./pharmacy.schemas";
import * as pharmaciesController from "./pharmacies.controller";

export const pharmaciesRouter = Router();

pharmaciesRouter.use(authenticate);

// Semua peran bisa membaca apotek dalam batas aksesnya; hanya Super Admin yang mengelola (BR-03).
pharmaciesRouter.get("/", pharmaciesController.listPharmacies);
pharmaciesRouter.get("/:id", pharmaciesController.getPharmacy);

pharmaciesRouter.use(authorize(UserRole.SUPER_ADMIN));

pharmaciesRouter.post("/", validateBody(createPharmacySchema), pharmaciesController.createPharmacy);
pharmaciesRouter.patch("/:id", validateBody(updatePharmacySchema), pharmaciesController.updatePharmacy);
pharmaciesRouter.patch("/:id/status", validateBody(updatePharmacyStatusSchema), pharmaciesController.updatePharmacyStatus);
