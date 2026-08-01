import { z } from "zod";

export const idParamsSchema = z.object({
  id: z.string().min(1),
});

export const createReportBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  kind: z.string().min(1).max(128),
  params: z.record(z.unknown()).optional(),
});

export const createAlertBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  severity: z.enum(["info", "low", "medium", "high", "critical"]).optional(),
  source: z.string().min(1).max(128).optional(),
  payload: z.record(z.unknown()).optional(),
});

export const createInvestigationBodySchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1).max(500),
  subjectDocumentId: z.string().uuid().optional(),
  lineagePublicCode: z.string().min(1).max(64).optional(),
});

export const appendEvidenceBodySchema = z.object({
  sourceType: z.string().min(1).max(128),
  contentHash: z.string().min(8).max(128),
  meta: z.record(z.unknown()).optional(),
  objectKey: z.string().max(1024).optional(),
});

export const createSubscriptionBodySchema = z.object({
  organizationId: z.string().uuid(),
  planKey: z.enum(["free", "starter", "growth", "enterprise"]),
  quota: z.record(z.unknown()).optional(),
});

export const createFeatureBodySchema = z.object({
  organizationId: z.string().uuid().optional().nullable(),
  key: z.string().min(1).max(128),
  status: z.enum(["active", "inactive", "pending", "suspended", "archived"]).optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  killSwitch: z.boolean().optional(),
  targeting: z.record(z.unknown()).optional(),
  experiments: z.record(z.unknown()).optional(),
});

export const createComplianceBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  framework: z.enum(["gdpr", "soc2", "iso27001"]),
  action: z.string().min(1).max(256),
  success: z.boolean().optional(),
  meta: z.record(z.unknown()).optional(),
});

export const createPolicyBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  name: z.string().min(1).max(256),
  definition: z.record(z.unknown()),
});

export const createDeploymentBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  environment: z.enum(["development", "staging", "production"]),
  meta: z.record(z.unknown()).optional(),
});
