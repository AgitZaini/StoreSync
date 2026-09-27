import { asyncHandler } from "../../utils/async-handler";
import * as filesService from "./files.service";

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const presignUpload = asyncHandler(async (req, res) => {
  const result = await filesService.createUpload(req.body, req.user!);
  res.status(201).json(result);
});

export const completeUpload = asyncHandler(async (req, res) => {
  const file = await filesService.completeUpload(getParam(req.params.id)!, req.user!);
  res.json({ file });
});

export const getFile = asyncHandler(async (req, res) => {
  const result = await filesService.getFile(getParam(req.params.id)!, req.user!);
  res.json(result);
});
