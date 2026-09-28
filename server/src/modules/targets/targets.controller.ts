import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { monthSchema } from "../../utils/schemas";
import { listTargetsQuerySchema } from "./target.schemas";
import * as targetsService from "./targets.service";

export const listTargets = asyncHandler(async (req, res) => {
  const { month } = listTargetsQuerySchema.parse(req.query);
  res.json(await targetsService.listTargets(month, req.user!));
});

export const upsertTargets = asyncHandler(async (req, res) => {
  const month = monthSchema.parse(routeParam(req, "month"));
  res.json(await targetsService.upsertTargets(month, req.body, req.user!, auditContext(req)));
});
