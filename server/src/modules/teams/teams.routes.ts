import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createTeamSchema, updateTeamSchema } from "./team.schemas";
import * as teamsController from "./teams.controller";

export const teamsRouter = Router();

teamsRouter.use(authenticate);

teamsRouter.get("/", authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEAM_LEADER), teamsController.listTeams);
teamsRouter.post("/", authorize(UserRole.SUPER_ADMIN), validateBody(createTeamSchema), teamsController.createTeam);
teamsRouter.patch("/:id", authorize(UserRole.SUPER_ADMIN), validateBody(updateTeamSchema), teamsController.updateTeam);
