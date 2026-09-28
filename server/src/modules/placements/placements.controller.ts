import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { listPlacementsQuerySchema } from "./placement.schemas";
import * as placementsService from "./placements.service";

export const listPlacements = asyncHandler(async (req, res) => {
  const placements = await placementsService.listPlacements(listPlacementsQuerySchema.parse(req.query), req.user!);
  res.json({ placements });
});

export const createPlacement = asyncHandler(async (req, res) => {
  const placement = await placementsService.createPlacement(req.body, req.user!, auditContext(req));
  res.status(201).json({ placement });
});

export const endPlacement = asyncHandler(async (req, res) => {
  const placement = await placementsService.endPlacement(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.json({ placement });
});
