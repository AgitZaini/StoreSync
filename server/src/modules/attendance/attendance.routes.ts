import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createAttendanceExceptionSchema, createAttendanceSchema, saveNoteSchema } from "./attendance.schemas";
import * as attendanceController from "./attendance.controller";

const { SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG } = UserRole;

export const attendanceRouter = Router();

attendanceRouter.use(authenticate);

// SPG (ABS-01). Absen kunjungan Team Leader dibuat terpisah di Tahap 4.
attendanceRouter.post("/", authorize(SPG), validateBody(createAttendanceSchema), attendanceController.createAttendance);
attendanceRouter.get("/today", authorize(SPG), attendanceController.getToday);
attendanceRouter.get("/", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), attendanceController.listHistory);

// ABS-04: pemantauan dibanding jadwal.
attendanceRouter.get("/monitor", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER), attendanceController.getMonitor);
attendanceRouter.put("/notes", authorize(ADMIN), validateBody(saveNoteSchema), attendanceController.saveNote);

// Pengecualian absen disetujui Admin (mitigasi risiko GPS dalam gedung di BRD).
attendanceRouter.post(
  "/exceptions",
  authorize(SPG),
  validateBody(createAttendanceExceptionSchema),
  attendanceController.createException,
);
attendanceRouter.get("/exceptions", authorize(SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG), attendanceController.listExceptions);
attendanceRouter.post("/exceptions/:id/approve", authorize(ADMIN), attendanceController.approveException);
attendanceRouter.post("/exceptions/:id/reject", authorize(ADMIN), attendanceController.rejectException);
