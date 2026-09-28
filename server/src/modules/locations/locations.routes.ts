import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { pingSchema } from "./location.schemas";
import * as locationsController from "./locations.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER } = UserRole;

export const locationsRouter = Router();

locationsRouter.use(authenticate);

// ABS-03: TL mengirim lokasi selama sesi kerja; Super Admin dan Admin melihat peta leader.
locationsRouter.post("/ping", authorize(TEAM_LEADER), validateBody(pingSchema), locationsController.recordPing);
locationsRouter.get("/leaders", authorize(SUPER_ADMIN, ADMIN), locationsController.listLeaderPositions);
locationsRouter.get("/leaders/:id/trail", authorize(SUPER_ADMIN, ADMIN), locationsController.getLeaderTrail);
