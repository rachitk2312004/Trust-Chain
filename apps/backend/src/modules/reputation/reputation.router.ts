import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  alertsQuerySchema,
  historyQuerySchema,
  leaderboardQuerySchema,
  patchReputationBodySchema,
  reputationIdParamsSchema,
  reputationQuerySchema,
  scoreBodySchema,
} from "./reputation.schemas.js";
import * as service from "./reputation.service.js";

export const reputationRouter = Router();

reputationRouter.use(requireAuth);

reputationRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(reputationQuerySchema, req.query);
    const data = await service.listReputation(req.user.id, query);
    res.status(200).json(data);
  }),
);

reputationRouter.post(
  "/score",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(scoreBodySchema, req.body ?? {});
    const data = await service.scoreSubject(req.user.id, body);
    res.status(201).json(data);
  }),
);

reputationRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(historyQuerySchema, req.query);
    const data = await service.listHistory(req.user.id, query);
    res.status(200).json(data);
  }),
);

reputationRouter.get(
  "/alerts",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(alertsQuerySchema, req.query);
    const data = await service.listAlerts(req.user.id, query);
    res.status(200).json(data);
  }),
);

reputationRouter.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(leaderboardQuerySchema, req.query);
    const data = await service.getLeaderboard(req.user.id, query);
    res.status(200).json(data);
  }),
);

reputationRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(reputationIdParamsSchema, req.params);
    const body = parseBody(patchReputationBodySchema, req.body ?? {});
    const data = await service.patchReputation(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);
