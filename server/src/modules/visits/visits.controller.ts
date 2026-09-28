import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import * as visitsService from "./visits.service";

export const recordVisitAttendance = asyncHandler(async (req, res) => {
  res.status(201).json(await visitsService.recordVisitAttendance(req.body, req.user!, auditContext(req)));
});

export const getToday = asyncHandler(async (req, res) => {
  res.json(await visitsService.getToday(req.user!));
});

export const endWorkDay = asyncHandler(async (req, res) => {
  res.json(await visitsService.endWorkDay(req.user!, auditContext(req)));
});
