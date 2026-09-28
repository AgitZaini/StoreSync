import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { weekStartSchema } from "../schedules/schedule.schemas";
import { visitPlanQuerySchema, visitPlanSummaryQuerySchema } from "./visit-plan.schemas";
import * as visitPlansService from "./visit-plans.service";

export const getPlanWeek = asyncHandler(async (req, res) => {
  const { weekStart, leaderId } = visitPlanQuerySchema.parse(req.query);
  res.json(await visitPlansService.getPlanWeek(weekStart, leaderId, req.user!));
});

export const getWeekSummary = asyncHandler(async (req, res) => {
  const { weekStart } = visitPlanSummaryQuerySchema.parse(req.query);
  res.json(await visitPlansService.getWeekSummary(weekStart));
});

export const savePlanWeek = asyncHandler(async (req, res) => {
  const weekStart = weekStartSchema.parse(routeParam(req, "weekStart"));
  res.json(await visitPlansService.savePlanWeek(weekStart, req.body, req.user!, auditContext(req)));
});

export const saveMissReason = asyncHandler(async (req, res) => {
  res.json(await visitPlansService.saveMissReason(routeParam(req, "id"), req.body, req.user!, auditContext(req)));
});
