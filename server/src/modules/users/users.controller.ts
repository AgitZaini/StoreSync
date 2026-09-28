import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { listUsersQuerySchema } from "./user.schemas";
import * as usersService from "./users.service";

export const listUsers = asyncHandler(async (req, res) => {
  const users = await usersService.listUsers(listUsersQuerySchema.parse(req.query));
  res.json({ users });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await usersService.getUser(routeParam(req, "id"));
  res.json({ user });
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body, req.user!, auditContext(req));
  res.status(201).json({ user });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.json({ user });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await usersService.updateUserStatus(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.json({ user });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await usersService.resetPassword(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.status(204).send();
});

export const updateUserTeam = asyncHandler(async (req, res) => {
  const user = await usersService.updateUserTeam(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.json({ user });
});
