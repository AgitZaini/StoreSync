import type { Request } from "express";
import { AppError } from "../middleware/error-handler";

/** Parameter route sebagai string tunggal (Express 5 bisa memberi array untuk wildcard). */
export const routeParam = (req: Request, name: string) => {
  const value = req.params[name];
  const param = Array.isArray(value) ? value[0] : value;

  if (!param) {
    throw new AppError(400, `Parameter ${name} wajib diisi`);
  }

  return param;
};
