import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  reindexBodySchema,
  searchQuerySchema,
  statusQuerySchema,
  suggestionsQuerySchema,
} from "./search.schemas.js";
import * as service from "./search.service.js";

export const searchRouter = Router();

searchRouter.use(requireAuth);

searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(searchQuerySchema, req.query);
    const data = await service.search(req.user.id, query);
    res.status(200).json(data);
  }),
);

searchRouter.get(
  "/suggestions",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(suggestionsQuerySchema, req.query);
    const data = await service.suggestions(req.user.id, query);
    res.status(200).json(data);
  }),
);

searchRouter.post(
  "/reindex",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(reindexBodySchema, req.body ?? {});
    const data = await service.reindex(req.user.id, body);
    res.status(200).json(data);
  }),
);

searchRouter.get(
  "/status",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(statusQuerySchema, req.query);
    const data = await service.getStatus(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);
