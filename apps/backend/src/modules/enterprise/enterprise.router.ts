import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  createEnterpriseRoleBodySchema,
  enterpriseOrgQuerySchema,
  enterpriseRoleIdParamsSchema,
  enterpriseRolesQuerySchema,
  patchEnterpriseRoleBodySchema,
  upsertSamlBodySchema,
  upsertScimBodySchema,
} from "./enterprise.schemas.js";
import * as service from "./enterprise.service.js";

export const enterpriseRouter = Router();

enterpriseRouter.use(requireAuth);

enterpriseRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(enterpriseOrgQuerySchema, req.query);
    const data = await service.getEnterprise(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

enterpriseRouter.post(
  "/saml",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(upsertSamlBodySchema, req.body ?? {});
    const data = await service.upsertSaml(req.user.id, body);
    res.status(200).json(data);
  }),
);

enterpriseRouter.post(
  "/scim",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(upsertScimBodySchema, req.body ?? {});
    const data = await service.upsertScim(req.user.id, body);
    res.status(200).json(data);
  }),
);

enterpriseRouter.get(
  "/roles",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(enterpriseRolesQuerySchema, req.query);
    const data = await service.listRoles(req.user.id, query);
    res.status(200).json(data);
  }),
);

enterpriseRouter.post(
  "/roles",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createEnterpriseRoleBodySchema, req.body ?? {});
    const data = await service.createRole(req.user.id, body);
    res.status(201).json(data);
  }),
);

enterpriseRouter.patch(
  "/roles/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(enterpriseRoleIdParamsSchema, req.params);
    const body = parseBody(patchEnterpriseRoleBodySchema, req.body ?? {});
    const data = await service.patchRole(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);
