import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createLegalHoldBodySchema,
  createRetentionPolicyBodySchema,
  legalHoldIdParamsSchema,
  legalHoldListQuerySchema,
  patchLegalHoldBodySchema,
  patchRetentionPolicyBodySchema,
  retentionOrgQuerySchema,
  retentionPolicyIdParamsSchema,
  retentionStatusQuerySchema,
  runRetentionBodySchema,
} from "./retention.schemas.js";
import * as service from "./retention.service.js";

export const retentionRouter = Router();

retentionRouter.use(requireAuth);

retentionRouter.get(
  "/policies",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(retentionOrgQuerySchema, req.query);
    const data = await service.listPolicies(req.user.id, query);
    res.status(200).json(data);
  }),
);

retentionRouter.post(
  "/policies",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createRetentionPolicyBodySchema, req.body ?? {});
    const data = await service.createPolicy(req.user.id, body);
    res.status(201).json(data);
  }),
);

retentionRouter.patch(
  "/policies/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(retentionPolicyIdParamsSchema, req.params);
    const body = parseBody(patchRetentionPolicyBodySchema, req.body ?? {});
    const data = await service.patchPolicy(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

retentionRouter.get(
  "/holds",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(legalHoldListQuerySchema, req.query);
    const data = await service.listHolds(req.user.id, query);
    res.status(200).json(data);
  }),
);

retentionRouter.post(
  "/holds",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createLegalHoldBodySchema, req.body ?? {});
    const data = await service.createHold(req.user.id, body);
    res.status(201).json(data);
  }),
);

retentionRouter.patch(
  "/holds/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(legalHoldIdParamsSchema, req.params);
    const body = parseBody(patchLegalHoldBodySchema, req.body ?? {});
    const data = await service.patchHold(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

retentionRouter.post(
  "/run",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(runRetentionBodySchema, req.body ?? {});
    const data = await service.runRetention(req.user.id, body);
    res.status(200).json(data);
  }),
);

retentionRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(retentionStatusQuerySchema, req.query);
    const data = await service.getStatus(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);
