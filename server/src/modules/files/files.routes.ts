import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { validateBody } from "../../middleware/validate-request";
import * as filesController from "./files.controller";
import { presignFileSchema } from "./file.schemas";

export const filesRouter = Router();

filesRouter.use(authenticate);

filesRouter.post("/presign", validateBody(presignFileSchema), filesController.presignUpload);
filesRouter.post("/:id/complete", filesController.completeUpload);
filesRouter.get("/:id", filesController.getFile);
