import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { saveScheduleWeekSchema } from "./schedule.schemas";
import * as schedulesController from "./schedules.controller";

export const schedulesRouter = Router();

schedulesRouter.use(authenticate);

schedulesRouter.get(
  "/",
  authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEAM_LEADER, UserRole.SPG),
  schedulesController.getWeek,
);
// JDW-01: hanya Admin yang mengisi jadwal (Super Admin cukup melihat).
schedulesRouter.put("/week/:weekStart", authorize(UserRole.ADMIN), validateBody(saveScheduleWeekSchema), schedulesController.saveWeek);
