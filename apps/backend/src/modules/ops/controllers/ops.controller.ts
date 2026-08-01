import type { Request, Response } from "express";
import { AppError } from "../../../lib/errors.js";
import { parseBody, parseParams } from "../../../lib/validate.js";
import * as svc from "../services/ops.service.js";
import {
  appendEvidenceBodySchema,
  createAlertBodySchema,
  createComplianceBodySchema,
  createDeploymentBodySchema,
  createFeatureBodySchema,
  createInvestigationBodySchema,
  createPolicyBodySchema,
  createReportBodySchema,
  createSubscriptionBodySchema,
  idParamsSchema,
} from "../validators/schemas.js";

function requireUser(req: Request): string {
  if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
  return req.user.id;
}

function orgQuery(req: Request): string | undefined {
  const v = req.query.organizationId;
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function postReport(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createReportBodySchema, req.body ?? {});
  const result = await svc.createReport(userId, body);
  res.status(201).json(result);
}

export async function getReport(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id } = parseParams(idParamsSchema, req.params);
  const result = await svc.getReport(userId, id);
  res.status(200).json(result);
}

export async function postAlert(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createAlertBodySchema, req.body ?? {});
  const result = await svc.createAlert(userId, body);
  res.status(201).json(result);
}

export async function getAlerts(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const result = await svc.listAlerts(userId, orgQuery(req));
  res.status(200).json(result);
}

export async function postInvestigation(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createInvestigationBodySchema, req.body ?? {});
  const result = await svc.createInvestigation(userId, body);
  res.status(201).json(result);
}

export async function getInvestigation(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id } = parseParams(idParamsSchema, req.params);
  const result = await svc.getInvestigation(userId, id);
  res.status(200).json(result);
}

export async function postEvidence(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id } = parseParams(idParamsSchema, req.params);
  const body = parseBody(appendEvidenceBodySchema, req.body ?? {});
  const result = await svc.appendEvidence(userId, id, body);
  res.status(201).json(result);
}

export async function postSubscription(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createSubscriptionBodySchema, req.body ?? {});
  const result = await svc.createSubscription(userId, body);
  res.status(201).json(result);
}

export async function getInvoices(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const result = await svc.listInvoices(userId, orgQuery(req));
  res.status(200).json(result);
}

export async function postFeature(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createFeatureBodySchema, req.body ?? {});
  const result = await svc.createFeature(userId, body);
  res.status(201).json(result);
}

export async function getFeatures(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const result = await svc.listFeatures(userId, orgQuery(req));
  res.status(200).json(result);
}

export async function postCompliance(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createComplianceBodySchema, req.body ?? {});
  const result = await svc.createComplianceEvent(userId, body);
  res.status(201).json(result);
}

export async function getCompliance(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const result = await svc.listComplianceEvents(userId, orgQuery(req));
  res.status(200).json(result);
}

export async function postPolicy(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createPolicyBodySchema, req.body ?? {});
  const result = await svc.createPolicy(userId, body);
  res.status(201).json(result);
}

export async function postPolicyApprove(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const { id } = parseParams(idParamsSchema, req.params);
  const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
  const result = await svc.approvePolicy(userId, id, notes);
  res.status(200).json(result);
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const result = await svc.getAnalyticsSummary(userId, orgQuery(req));
  res.status(200).json(result);
}

export async function getHealth(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const result = await svc.getHealth(userId, orgQuery(req));
  res.status(200).json(result);
}

export async function postDeployment(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const body = parseBody(createDeploymentBodySchema, req.body ?? {});
  const result = await svc.createDeployment(userId, body);
  res.status(201).json(result);
}

export async function postRecoveryBackup(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const organizationId = orgQuery(req) ?? (req.body?.organizationId as string | undefined);
  const result = await svc.createRecoveryBackup(userId, organizationId);
  res.status(201).json(result);
}

export async function postCapacity(req: Request, res: Response): Promise<void> {
  const userId = requireUser(req);
  const organizationId = orgQuery(req) ?? (req.body?.organizationId as string | undefined);
  const result = await svc.recordCapacity(userId, organizationId, {
    storageBytes: typeof req.body?.storageBytes === "number" ? req.body.storageBytes : undefined,
    computeUnits: typeof req.body?.computeUnits === "number" ? req.body.computeUnits : undefined,
    networkBytes: typeof req.body?.networkBytes === "number" ? req.body.networkBytes : undefined,
  });
  res.status(201).json(result);
}
