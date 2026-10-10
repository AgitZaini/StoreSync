import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { locationDateQuerySchema } from "./location.schemas";
import * as locationsService from "./locations.service";

export const recordPing = asyncHandler(async (req, res) => {
  res.json(await locationsService.recordPing(req.body, req.user!));
});

export const listLeaderPositions = asyncHandler(async (req, res) => {
  const { date } = locationDateQuerySchema.parse(req.query);
  res.json(await locationsService.listLeaderPositions(date));
});

export const getLeaderTrail = asyncHandler(async (req, res) => {
  const { date } = locationDateQuerySchema.parse(req.query);
  res.json(await locationsService.getLeaderTrail(routeParam(req, "id"), date));
});
