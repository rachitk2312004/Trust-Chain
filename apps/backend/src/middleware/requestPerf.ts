import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { runWithPerfAccumulator, type RequestPerfAccumulator } from "@trustchain/database";

declare module "express-serve-static-core" {
  interface Request {
    requestId?: string;
  }
  interface Locals {
    perf?: RequestPerfAccumulator;
  }
}

/** Attach per-request correlation id + DB/auth timing when PERF_LOG=1. */
export const requestPerfMiddleware: RequestHandler = (req, res, next) => {
  const requestId = randomUUID().slice(0, 8);
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);

  if (process.env.PERF_LOG !== "1") {
    next();
    return;
  }

  const perf: RequestPerfAccumulator = {
    requestId,
    authMs: 0,
    authCacheHit: false,
    dbMs: 0,
    dbQueries: 0,
    queryLog: [],
  };
  res.locals.perf = perf;
  runWithPerfAccumulator(perf, () => next());
};
