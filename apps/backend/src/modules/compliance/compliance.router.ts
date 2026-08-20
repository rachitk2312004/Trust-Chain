import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  complianceFrameworksQuerySchema,
  complianceIdParamsSchema,
  complianceListQuerySchema,
  complianceReportsQuerySchema,
  complianceRunBodySchema,
  patchRemediationBodySchema,
} from "./compliance.schemas.js";
import * as service from "./compliance.service.js";

export const complianceRouter = Router();

complianceRouter.use(requireAuth);

complianceRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(complianceListQuerySchema, req.query);
    if (req.query.list === "assessments") {
      const data = await service.listComplianceAssessments(req.user.id, query);
      res.status(200).json(data);
      return;
    }
    const data = await service.getComplianceDashboard(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

complianceRouter.get(
  "/frameworks",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(complianceFrameworksQuerySchema, req.query);
    const data = await service.getComplianceFrameworks(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

complianceRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(complianceReportsQuerySchema, req.query);
    const data = await service.listComplianceReports(req.user.id, query);
    res.status(200).json(data);
  }),
);

complianceRouter.post(
  "/run",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(complianceRunBodySchema, req.body ?? {});
    const data = await service.runComplianceAssessment(req.user.id, {
      ...body,
      framework: body.framework as
        | "soc2"
        | "iso27001"
        | "gdpr"
        | "hipaa",
    });
    res.status(200).json(data);
  }),
);

complianceRouter.patch(
  "/remediations/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(complianceIdParamsSchema, req.params);
    const body = parseBody(patchRemediationBodySchema, req.body ?? {});
    const data = await service.patchRemediation(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

complianceRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(complianceIdParamsSchema, req.params);
    const data = await service.getComplianceAssessment(req.user.id, params.id);
    res.status(200).json(data);
  }),
);
