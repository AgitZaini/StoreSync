import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import * as teamsService from "./teams.service";

export const listTeams = asyncHandler(async (req, res) => {
  const teams = await teamsService.listTeams(req.user!);
  res.json({ teams });
});

export const createTeam = asyncHandler(async (req, res) => {
  const team = await teamsService.createTeam(req.body, req.user!, auditContext(req));
  res.status(201).json({ team });
});

export const updateTeam = asyncHandler(async (req, res) => {
  const team = await teamsService.updateTeam(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.json({ team });
});
