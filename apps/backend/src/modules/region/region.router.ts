import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createRegionBodySchema,
  failoverBodySchema,
  listRegionsQuerySchema,
  patchRegionBodySchema,
  regionIdParamsSchema,
  residencyQuerySchema,
  routingQuerySchema,
} from "./region.schemas.js";
import * as service from "./region.service.js";

export const regionRouter = Router();

regionRouter.use(requireAuth);

// Static paths before /:id
regionRouter.get(
  "/routing",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(routingQuerySchema, req.query);
    const data = await service.getRouting(req.user.id, query);
    res.status(200).json(data);
  }),
);

regionRouter.post(
  "/failover",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(failoverBodySchema, req.body ?? {});
    const data = await service.triggerFailover(req.user.id, body);
    res.status(200).json(data);
  }),
);

regionRouter.get(
  "/residency",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(residencyQuerySchema, req.query);
    const data = await service.getResidency(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

regionRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listRegionsQuerySchema, req.query);
    const data = await service.listRegions(req.user.id, query);
    res.status(200).json(data);
  }),
);

regionRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createRegionBodySchema, req.body ?? {});
    const data = await service.createRegion(req.user.id, body);
    res.status(201).json(data);
  }),
);

regionRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(regionIdParamsSchema, req.params);
    const body = parseBody(patchRegionBodySchema, req.body ?? {});
    const data = await service.patchRegion(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);
