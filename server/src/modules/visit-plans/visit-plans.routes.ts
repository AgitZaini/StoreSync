import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { missReasonSchema, saveVisitPlanSchema } from "./visit-plan.schemas";
import * as visitPlansController from "./visit-plans.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER } = UserRole;

export const visitPlansRouter = Router();

visitPlansRouter.use(authenticate);

// KNJ-01: rencana disusun TL sendiri. KNJ-02: evaluasi dilihat TL (miliknya), Super Admin, dan Admin.
visitPlansRouter.get("/", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER), visitPlansController.getPlanWeek);
visitPlansRouter.get("/summary", authorize(SUPER_ADMIN, ADMIN), visitPlansController.getWeekSummary);
visitPlansRouter.put("/week/:weekStart", authorize(TEAM_LEADER), validateBody(saveVisitPlanSchema), visitPlansController.savePlanWeek);
visitPlansRouter.put("/items/:id/reason", authorize(TEAM_LEADER), validateBody(missReasonSchema), visitPlansController.saveMissReason);
