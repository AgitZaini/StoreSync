import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import * as usersService from "./users.service";

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await usersService.listUsers();
  res.json({ users });
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body, req.user!, auditContext(req));
  res.status(201).json({ user });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const user = await usersService.updateUserStatus(getParam(req.params.id)!, req.body, req.user!, auditContext(req));
  res.json({ user });
});
