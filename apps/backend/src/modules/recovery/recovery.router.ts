import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createBackupBodySchema,
  createFailbackBodySchema,
  createRestoreBodySchema,
  recoveryOrgQuerySchema,
  recoveryReportsQuerySchema,
  recoveryStatusQuerySchema,
} from "./recovery.schemas.js";
import * as service from "./recovery.service.js";

export const recoveryRouter = Router();

recoveryRouter.use(requireAuth);

recoveryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(recoveryOrgQuerySchema, req.query);
    const data = await service.getRecovery(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

recoveryRouter.post(
  "/backups",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createBackupBodySchema, req.body ?? {});
    const data = await service.createBackup(req.user.id, body);
    res.status(201).json(data);
  }),
);

recoveryRouter.post(
  "/restores",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createRestoreBodySchema, req.body ?? {});
    const data = await service.createRestore(req.user.id, body);
    res.status(201).json(data);
  }),
);

recoveryRouter.post(
  "/failback",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createFailbackBodySchema, req.body ?? {});
    const data = await service.createFailback(req.user.id, body);
    res.status(201).json(data);
  }),
);

recoveryRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(recoveryStatusQuerySchema, req.query);
    const data = await service.getStatus(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

recoveryRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(recoveryReportsQuerySchema, req.query);
    const data = await service.listReports(req.user.id, query);
    res.status(200).json(data);
  }),
);
