import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { scheduleWeekQuerySchema, weekStartSchema } from "./schedule.schemas";
import * as schedulesService from "./schedules.service";

export const getWeek = asyncHandler(async (req, res) => {
  res.json(await schedulesService.getWeek(scheduleWeekQuerySchema.parse(req.query), req.user!));
});

export const saveWeek = asyncHandler(async (req, res) => {
  const weekStart = weekStartSchema.parse(routeParam(req, "weekStart"));
  res.json(await schedulesService.saveWeek(weekStart, req.body, req.user!, auditContext(req)));
});
