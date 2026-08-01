import { ApiConstants, DefaultPorts } from "@trustchain/config";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { healthRouter } from "./modules/health/health.router.js";
import { v1Router } from "./routes/v1.js";
import { publicVerificationRouter } from "./modules/public-verification/routes/publicVerification.router.js";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(requestLogger);
  app.use(healthRouter);
  app.use("/api/public", publicVerificationRouter);
  app.use(ApiConstants.prefix, v1Router);
  app.use(errorHandler);

  return app;
}

export function getPort(): number {
  const raw = process.env.PORT;
  if (raw === undefined || raw === "") {
    return DefaultPorts.backend;
  }
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return DefaultPorts.backend;
  }
  return parsed;
}
