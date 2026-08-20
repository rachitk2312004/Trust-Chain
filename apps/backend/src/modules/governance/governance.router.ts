import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createPolicyBodySchema,
  createRiskBodySchema,
  governanceOrgQuerySchema,
  governanceReportsQuerySchema,
  listRisksQuerySchema,
  patchPolicyBodySchema,
  patchRiskBodySchema,
  policyIdParamsSchema,
  riskIdParamsSchema,
} from "./governance.schemas.js";
import * as service from "./governance.service.js";

export const governanceRouter = Router();

governanceRouter.use(requireAuth);

governanceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(governanceOrgQuerySchema, req.query);
    const data = await service.getGovernance(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

governanceRouter.post(
  "/policies",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createPolicyBodySchema, req.body ?? {});
    const data = await service.createPolicy(req.user.id, body);
    res.status(201).json(data);
  }),
);

governanceRouter.patch(
  "/policies/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(policyIdParamsSchema, req.params);
    const body = parseBody(patchPolicyBodySchema, req.body ?? {});
    const data = await service.patchPolicy(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

governanceRouter.get(
  "/risks",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listRisksQuerySchema, req.query);
    const data = await service.listRisks(req.user.id, query);
    res.status(200).json(data);
  }),
);

governanceRouter.post(
  "/risks",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createRiskBodySchema, req.body ?? {});
    const data = await service.createRisk(req.user.id, body);
    res.status(201).json(data);
  }),
);

governanceRouter.patch(
  "/risks/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(riskIdParamsSchema, req.params);
    const body = parseBody(patchRiskBodySchema, req.body ?? {});
    const data = await service.patchRisk(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

governanceRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(governanceReportsQuerySchema, req.query);
    const data = await service.listReports(req.user.id, query);
    res.status(200).json(data);
  }),
);
