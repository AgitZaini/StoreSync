import { asyncHandler } from "../../utils/async-handler";
import * as usersService from "./users.service";

export const listUsers = asyncHandler(async (_req, res) => {
  const users = await usersService.listUsers();
  res.json({ users });
});

export const createUser = asyncHandler(async (req, res) => {
  const user = await usersService.createUser(req.body);
  res.status(201).json({ user });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const userId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const user = await usersService.updateUserStatus(userId, req.body);
  res.json({ user });
});
