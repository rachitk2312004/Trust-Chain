import { DefaultPorts } from "@trustchain/config";
import express from "express";
import { healthRouter } from "./modules/health/health.router.js";

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(healthRouter);

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
