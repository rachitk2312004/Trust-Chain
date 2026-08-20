import { ApiConstants, DefaultPorts } from "@trustchain/config";
import express from "express";
import { errorHandler } from "./middleware/errorHandler.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { requestPerfMiddleware } from "./middleware/requestPerf.js";
import { healthRouter } from "./modules/health/health.router.js";
import { v1Router } from "./routes/v1.js";
import { publicVerificationRouter } from "./modules/public-verification/routes/publicVerification.router.js";
import { publicQrRouter } from "./modules/qr/routes/qr.router.js";
import { publicCertificateRouter } from "./modules/certificates/certificates.public.router.js";
import { publicDeveloperApiRouter } from "./modules/developer/developer.api.js";

function corsMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const allowed = (process.env.CORS_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  if (origin && (allowed.includes("*") || allowed.includes(origin))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Requested-With",
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
}

export function createApp() {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json({ limit: "1mb" }));
  app.use(requestPerfMiddleware);
  app.use(requestLogger);
  app.use(healthRouter);
  app.use("/api/public/v1", publicDeveloperApiRouter);
  app.use("/api/public", publicVerificationRouter);
  app.use("/api/public", publicQrRouter);
  app.use("/api/public", publicCertificateRouter);
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
