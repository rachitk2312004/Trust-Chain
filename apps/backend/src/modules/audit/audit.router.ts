import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  auditExportBodySchema,
  auditIdParamsSchema,
  auditListQuerySchema,
  auditStatusQuerySchema,
  auditTimelineQuerySchema,
} from "./audit.schemas.js";
import * as service from "./audit.service.js";

export const auditRouter = Router();

auditRouter.use(requireAuth);

auditRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(auditListQuerySchema, req.query);
    const data = await service.listAuditEvents(req.user.id, query);
    res.status(200).json(data);
  }),
);

auditRouter.get(
  "/timeline",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(auditTimelineQuerySchema, req.query);
    const data = await service.getAuditTimeline(req.user.id, query);
    res.status(200).json(data);
  }),
);

auditRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(auditStatusQuerySchema, req.query);
    const data = await service.getAuditInfrastructureStatus(
      req.user.id,
      query.organizationId,
    );
    res.status(200).json(data);
  }),
);

auditRouter.post(
  "/export",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(auditExportBodySchema, req.body ?? {});
    const data = await service.exportAuditEvents(req.user.id, {
      ...body,
      format: body.format as "json" | "csv",
    });
    res.status(200).json(data);
  }),
);

auditRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(auditIdParamsSchema, req.params);
    const organizationId =
      typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const data = await service.getAuditEvent(req.user.id, params.id, organizationId);
    res.status(200).json(data);
  }),
);
