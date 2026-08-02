import type { Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { parseBody, parseParams } from "../../../lib/validate.js";
import { getAiAnalyticsSnapshot } from "../services/analytics.js";
import * as svc from "../services/ai.service.js";
import { getAiGatewayHealth, listAiModels } from "../services/gatewayHealth.js";
import {
  aiDocumentBodySchema,
  aiReviewBodySchema,
  aiSearchBodySchema,
  jobParamsSchema,
  orgJobParamsSchema,
  orgParamsSchema,
} from "../validators/schemas.js";

function requireUser(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.id;
}

function resolveOrgId(req: Request, bodyOrg?: string): string {
  const fromParams = req.params.id;
  if (typeof fromParams === "string" && fromParams.length > 0) return fromParams;
  if (bodyOrg) return bodyOrg;
  throw new AppError(400, "VALIDATION_ERROR", "organizationId is required");
}

export async function postOcr(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(aiDocumentBodySchema, req.body ?? {});
  const organizationId = resolveOrgId(req, body.organizationId);
  const result = await svc.createOcrJob(userId, organizationId, body);
  res.status(201).json(result);
}

export async function postExtract(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(aiDocumentBodySchema, req.body ?? {});
  const organizationId = resolveOrgId(req, body.organizationId);
  const result = await svc.createExtractJob(userId, organizationId, body);
  res.status(201).json(result);
}

export async function postClassify(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(aiDocumentBodySchema, req.body ?? {});
  const organizationId = resolveOrgId(req, body.organizationId);
  const result = await svc.createClassifyJob(userId, organizationId, body);
  res.status(201).json(result);
}

export async function postSearch(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(aiSearchBodySchema, req.body ?? {});
  const organizationId = resolveOrgId(req, body.organizationId);
  const result = await svc.createSearchJob(userId, organizationId, body);
  res.status(200).json(result);
}

export async function postFraud(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(aiDocumentBodySchema, req.body ?? {});
  const organizationId = resolveOrgId(req, body.organizationId);
  const result = await svc.createFraudJob(userId, organizationId, body);
  res.status(201).json(result);
}

export async function getJob(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const params = parseParams(jobParamsSchema, req.params);
  const organizationId = String(req.query.organizationId ?? "");
  if (!organizationId) {
    throw new AppError(400, "VALIDATION_ERROR", "organizationId query parameter is required");
  }
  const result = await svc.getAiJob(userId, organizationId, params.jobId);
  res.status(200).json(result);
}

export async function getOrgJob(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const params = parseParams(orgJobParamsSchema, req.params);
  const result = await svc.getAiJob(userId, params.id, params.jobId);
  res.status(200).json(result);
}

export async function postOrgReview(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const params = parseParams(orgJobParamsSchema, req.params);
  const body = parseBody(aiReviewBodySchema, req.body ?? {});
  const result = await svc.reviewAiJob(userId, params.id, params.jobId, body);
  res.status(200).json(result);
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  requireUser(req);
  parseParams(orgParamsSchema, req.params);
  res.status(200).json({ analytics: getAiAnalyticsSnapshot() });
}

export async function getModels(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const result = await listAiModels();
  res.status(200).json(result);
}

export async function getHealth(req: Request, res: Response): Promise<void> {
  requireUser(req);
  const result = await getAiGatewayHealth();
  res.status(200).json(result);
}
