import { ApiConstants } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";

export const healthRouter = Router();

healthRouter.get(ApiConstants.healthPath, (_req, res) => {
  res.status(200).json({ status: "ok" });
});

/** Baseline DB round-trip for performance debugging (no auth). */
healthRouter.get(
  "/api/v1/health/db",
  asyncHandler(async (_req, res) => {
    const started = process.hrtime.bigint();
    await prisma.$queryRaw`SELECT 1`;
    const dbMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    res.status(200).json({ status: "ok", dbMs: Math.round(dbMs) });
  }),
);
