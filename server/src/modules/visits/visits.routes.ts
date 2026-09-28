import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createAttendanceSchema } from "../attendance/attendance.schemas";
import * as visitsController from "./visits.controller";

export const visitsRouter = Router();

// ABS-02/ABS-03: absen kunjungan dan sesi kerja milik Team Leader sendiri.
visitsRouter.use(authenticate, authorize(UserRole.TEAM_LEADER));

visitsRouter.post("/attendance", validateBody(createAttendanceSchema), visitsController.recordVisitAttendance);
visitsRouter.get("/today", visitsController.getToday);
visitsRouter.post("/end-day", visitsController.endWorkDay);
