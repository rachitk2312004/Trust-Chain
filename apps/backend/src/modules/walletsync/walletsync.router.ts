import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  linkWalletBodySchema,
  patchWalletBodySchema,
  syncWalletsBodySchema,
  verifyWalletBodySchema,
  walletHistoryQuerySchema,
  walletIdParamsSchema,
  walletsOrgQuerySchema,
} from "./walletsync.schemas.js";
import * as service from "./walletsync.service.js";

export const walletsRouter = Router();

walletsRouter.use(requireAuth);

walletsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(walletsOrgQuerySchema, req.query);
    const data = await service.listWallets(req.user.id, query);
    res.status(200).json(data);
  }),
);

walletsRouter.post(
  "/link",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(linkWalletBodySchema, req.body ?? {});
    const data = await service.linkWallet(req.user.id, body);
    res.status(201).json(data);
  }),
);

walletsRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(verifyWalletBodySchema, req.body ?? {});
    const data = await service.verifyWallet(req.user.id, body);
    res.status(200).json(data);
  }),
);

walletsRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(walletHistoryQuerySchema, req.query);
    const data = await service.listHistory(req.user.id, query);
    res.status(200).json(data);
  }),
);

walletsRouter.post(
  "/sync",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(syncWalletsBodySchema, req.body ?? {});
    const data = await service.syncWallets(req.user.id, body);
    res.status(201).json(data);
  }),
);

walletsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(walletIdParamsSchema, req.params);
    const body = parseBody(patchWalletBodySchema, req.body ?? {});
    const data = await service.patchWallet(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);
