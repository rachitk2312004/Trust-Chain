import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  analyticsQuerySchema,
  connectorIdParamsSchema,
  createConnectorBodySchema,
  installBodySchema,
  marketplaceQuerySchema,
  patchConnectorBodySchema,
  reviewsQuerySchema,
} from "./marketplace.schemas.js";
import * as service from "./marketplace.service.js";

export const marketplaceRouter = Router();

marketplaceRouter.use(requireAuth);

marketplaceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(marketplaceQuerySchema, req.query);
    const data = await service.listMarketplace(req.user.id, query);
    res.status(200).json(data);
  }),
);

marketplaceRouter.post(
  "/connectors",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createConnectorBodySchema, req.body ?? {});
    const data = await service.publishConnector(req.user.id, body);
    res.status(201).json(data);
  }),
);

marketplaceRouter.post(
  "/install",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(installBodySchema, req.body ?? {});
    const data = await service.installConnector(req.user.id, body);
    res.status(201).json(data);
  }),
);

marketplaceRouter.get(
  "/reviews",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(reviewsQuerySchema, req.query);
    const data = await service.listReviews(req.user.id, query);
    res.status(200).json(data);
  }),
);

marketplaceRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getAnalytics(req.user.id, query);
    res.status(200).json(data);
  }),
);

marketplaceRouter.patch(
  "/connectors/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(connectorIdParamsSchema, req.params);
    const body = parseBody(patchConnectorBodySchema, req.body ?? {});
    const data = await service.patchConnector(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);
