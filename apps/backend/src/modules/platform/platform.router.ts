import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  featureIdParamsSchema,
  metricsQuerySchema,
  patchConfigurationBodySchema,
  patchFeatureBodySchema,
  platformFeaturesQuerySchema,
} from "./platform.schemas.js";
import * as service from "./platform.service.js";

export const platformRouter = Router();

platformRouter.use(requireAuth);

platformRouter.get(
  "/health",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.getHealth(req.user.id);
    res.status(200).json(data);
  }),
);

platformRouter.get(
  "/readiness",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.getReadiness(req.user.id);
    res.status(200).json(data);
  }),
);

platformRouter.get(
  "/configuration",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.listConfiguration(req.user.id);
    res.status(200).json(data);
  }),
);

platformRouter.patch(
  "/configuration",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(patchConfigurationBodySchema, req.body ?? {});
    const data = await service.patchConfiguration(req.user.id, body);
    res.status(200).json(data);
  }),
);

platformRouter.get(
  "/features",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(platformFeaturesQuerySchema, req.query);
    const data = await service.listFeatures(req.user.id, query);
    res.status(200).json(data);
  }),
);

platformRouter.patch(
  "/features/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(featureIdParamsSchema, req.params);
    const body = parseBody(patchFeatureBodySchema, req.body ?? {});
    const data = await service.patchFeature(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

platformRouter.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(metricsQuerySchema, req.query);
    const data = await service.getMetrics(req.user.id, { persist: query.persist });
    res.status(200).json(data);
  }),
);
