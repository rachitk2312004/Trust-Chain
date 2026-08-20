import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createEvidenceBodySchema,
  evidenceIdParamsSchema,
  evidenceListQuerySchema,
  exportEvidenceBodySchema,
  linkEvidenceBodySchema,
  patchEvidenceBodySchema,
} from "./evidence.schemas.js";
import * as service from "./evidence.service.js";

export const evidenceRouter = Router();

evidenceRouter.use(requireAuth);

evidenceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(evidenceListQuerySchema, req.query);
    const data = await service.listEvidence(req.user.id, query);
    res.status(200).json(data);
  }),
);

evidenceRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createEvidenceBodySchema, req.body ?? {});
    const data = await service.createEvidence(req.user.id, body);
    res.status(201).json(data);
  }),
);

evidenceRouter.post(
  "/export",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(exportEvidenceBodySchema, req.body ?? {});
    const data = await service.exportEvidence(req.user.id, {
      ...body,
      format: body.format as "json" | "csv",
    });
    res.status(200).json(data);
  }),
);

evidenceRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(evidenceIdParamsSchema, req.params);
    const data = await service.getEvidence(req.user.id, params.id);
    res.status(200).json(data);
  }),
);

evidenceRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(evidenceIdParamsSchema, req.params);
    const body = parseBody(patchEvidenceBodySchema, req.body ?? {});
    const data = await service.patchEvidence(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

evidenceRouter.post(
  "/:id/link",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(evidenceIdParamsSchema, req.params);
    const body = parseBody(linkEvidenceBodySchema, req.body ?? {});
    const data = await service.linkEvidence(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);
