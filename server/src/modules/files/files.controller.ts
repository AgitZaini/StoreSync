import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import * as filesService from "./files.service";

export const presignUpload = asyncHandler(async (req, res) => {
  const result = await filesService.createUpload(req.body, req.user!);
  res.status(201).json(result);
});

export const completeUpload = asyncHandler(async (req, res) => {
  const file = await filesService.completeUpload(routeParam(req, "id"), req.user!);
  res.json({ file });
});

export const getFile = asyncHandler(async (req, res) => {
  const result = await filesService.getFile(routeParam(req, "id"), req.user!);
  res.json(result);
});
