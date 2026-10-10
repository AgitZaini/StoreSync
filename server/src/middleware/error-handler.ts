import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    /** Kode mesin untuk client, misalnya PASSWORD_CHANGE_REQUIRED. */
    public readonly code?: string,
    /** Data tambahan untuk client, misalnya jarak saat absen ditolak. */
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      status: "error",
      message: "Data yang dikirim tidak valid",
      issues: error.issues,
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      status: "error",
      message: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    res.status(409).json({
      status: "error",
      message: "Data yang sama sudah terdaftar",
    });
    return;
  }

  // Body JSON rusak atau terlalu besar (ditolak express.json sebelum sampai ke route).
  if (typeof error?.type === "string" && typeof error?.status === "number" && error.status >= 400 && error.status < 500) {
    res.status(error.status).json({
      status: "error",
      message: error.status === 413 ? "Data yang dikirim terlalu besar" : "Format data tidak valid",
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    status: "error",
    message: "Terjadi kesalahan pada server",
  });
};
