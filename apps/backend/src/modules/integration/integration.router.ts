import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createIntegrationBodySchema,
  eventsQuerySchema,
  integrationIdParamsSchema,
  integrationsQuerySchema,
  oauthBodySchema,
  patchIntegrationBodySchema,
  syncBodySchema,
} from "./integration.schemas.js";
import * as service from "./integration.service.js";

export const integrationRouter = Router();

integrationRouter.use(requireAuth);

integrationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(integrationsQuerySchema, req.query);
    const data = await service.listIntegrations(req.user.id, query);
    res.status(200).json(data);
  }),
);

integrationRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createIntegrationBodySchema, req.body ?? {});
    const data = await service.createIntegration(req.user.id, body);
    res.status(201).json(data);
  }),
);

integrationRouter.post(
  "/oauth",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(oauthBodySchema, req.body ?? {});
    const data = await service.handleOAuth(req.user.id, body);
    res.status(200).json(data);
  }),
);

integrationRouter.post(
  "/sync",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(syncBodySchema, req.body ?? {});
    const data = await service.syncIntegrations(req.user.id, body);
    res.status(201).json(data);
  }),
);

integrationRouter.get(
  "/events",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(eventsQuerySchema, req.query);
    const data = await service.listEvents(req.user.id, query);
    res.status(200).json(data);
  }),
);

integrationRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(integrationIdParamsSchema, req.params);
    const body = parseBody(patchIntegrationBodySchema, req.body ?? {});
    const data = await service.patchIntegration(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);
