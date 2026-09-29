import { Prisma } from "@trustchain/database";
import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { isAppError } from "../lib/errors.js";

const PRISMA_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1017", "P2024"]);
const PRISMA_TIMEOUT_CODES = new Set(["P2028"]);

function isDatabaseUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { name?: string; code?: string; message?: string };
  if (err.code && PRISMA_UNAVAILABLE_CODES.has(err.code)) return true;
  if (err.name === "PrismaClientInitializationError") return true;
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  const message = (err.message ?? "").toLowerCase();
  return (
    message.includes("server has closed the connection") ||
    message.includes("can't reach database server") ||
    message.includes("connection reset") ||
    message.includes("timed out fetching a new connection")
  );
}

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (isAppError(error)) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Validation failed",
        details: error.flatten(),
      },
    });
    return;
  }

  if (error && typeof error === "object" && "code" in error && PRISMA_TIMEOUT_CODES.has(String((error as { code?: string }).code))) {
    console.error(error);
    res.status(503).json({
      error: {
        code: "DATABASE_TIMEOUT",
        message: "The database took too long to finish. Try issuing again.",
      },
    });
    return;
  }

  if (isDatabaseUnavailable(error)) {
    console.error(error);
    res.status(503).json({
      error: {
        code: "DATABASE_UNAVAILABLE",
        message:
          "Cannot reach the PostgreSQL database. Check that the Render Postgres instance is running and DATABASE_URL is current, then restart the backend.",
      },
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  });
};
