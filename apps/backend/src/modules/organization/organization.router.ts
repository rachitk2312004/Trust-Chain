import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  businessUnitIdParamsSchema,
  createApprovalBodySchema,
  createBusinessUnitBodySchema,
  createDepartmentBodySchema,
  departmentIdParamsSchema,
  hierarchyQuerySchema,
  orgPlatformQuerySchema,
  patchBusinessUnitBodySchema,
  patchDepartmentBodySchema,
} from "./organization.schemas.js";
import * as service from "./organization.service.js";

export const organizationPlatformRouter = Router();

organizationPlatformRouter.use(requireAuth);

organizationPlatformRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(orgPlatformQuerySchema, req.query);
    const data = await service.getOrganization(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

organizationPlatformRouter.post(
  "/departments",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createDepartmentBodySchema, req.body ?? {});
    const data = await service.createDepartment(req.user.id, body);
    res.status(201).json(data);
  }),
);

organizationPlatformRouter.patch(
  "/departments/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(departmentIdParamsSchema, req.params);
    const body = parseBody(patchDepartmentBodySchema, req.body ?? {});
    const data = await service.patchDepartment(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

organizationPlatformRouter.post(
  "/business-units",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createBusinessUnitBodySchema, req.body ?? {});
    const data = await service.createBusinessUnit(req.user.id, body);
    res.status(201).json(data);
  }),
);

organizationPlatformRouter.patch(
  "/business-units/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(businessUnitIdParamsSchema, req.params);
    const body = parseBody(patchBusinessUnitBodySchema, req.body ?? {});
    const data = await service.patchBusinessUnit(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

organizationPlatformRouter.get(
  "/hierarchy",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(hierarchyQuerySchema, req.query);
    const data = await service.getHierarchy(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

organizationPlatformRouter.post(
  "/approvals",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createApprovalBodySchema, req.body ?? {});
    const data = await service.createApproval(req.user.id, body);
    res.status(201).json(data);
  }),
);
