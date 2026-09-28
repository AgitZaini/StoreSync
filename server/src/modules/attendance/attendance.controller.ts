import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import {
  historyQuerySchema,
  listExceptionsQuerySchema,
  monitorQuerySchema,
  rejectExceptionSchema,
  reviewExceptionSchema,
} from "./attendance.schemas";
import * as attendanceService from "./attendance.service";

export const createAttendance = asyncHandler(async (req, res) => {
  res.status(201).json(await attendanceService.createAttendance(req.body, req.user!, auditContext(req)));
});

export const getToday = asyncHandler(async (req, res) => {
  res.json(await attendanceService.getToday(req.user!));
});

export const listHistory = asyncHandler(async (req, res) => {
  res.json({ attendances: await attendanceService.listHistory(historyQuerySchema.parse(req.query), req.user!) });
});

export const getMonitor = asyncHandler(async (req, res) => {
  const { date } = monitorQuerySchema.parse(req.query);
  res.json(await attendanceService.getMonitor(date, req.user!));
});

export const saveNote = asyncHandler(async (req, res) => {
  res.json({ note: await attendanceService.saveNote(req.body, req.user!, auditContext(req)) });
});

export const createException = asyncHandler(async (req, res) => {
  res.status(201).json({ exception: await attendanceService.createException(req.body, req.user!, auditContext(req)) });
});

export const listExceptions = asyncHandler(async (req, res) => {
  const { status } = listExceptionsQuerySchema.parse(req.query);
  res.json({ exceptions: await attendanceService.listExceptions(status, req.user!) });
});

export const approveException = asyncHandler(async (req, res) => {
  const { note } = reviewExceptionSchema.parse(req.body ?? {});
  res.json({ exception: await attendanceService.approveException(routeParam(req, "id"), note, req.user!, auditContext(req)) });
});

export const rejectException = asyncHandler(async (req, res) => {
  const { note } = rejectExceptionSchema.parse(req.body);
  res.json({ exception: await attendanceService.rejectException(routeParam(req, "id"), note, req.user!, auditContext(req)) });
});
