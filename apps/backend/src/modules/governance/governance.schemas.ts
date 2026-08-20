import { z } from "zod";
import {
  GovernanceAssessmentStatusList,
  GovernanceDefaults,
  GovernanceFrameworkList,
  GovernancePolicyStatusList,
  GovernanceRiskStatusList,
} from "@trustchain/config";

export const governanceOrgQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const createPolicyBodySchema = z.object({
  organizationId: z.string().uuid(),
  framework: z.enum(GovernanceFrameworkList as [string, ...string[]]),
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Invalid policy key"),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(GovernancePolicyStatusList as [string, ...string[]]).optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
});

export const patchPolicyBodySchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(GovernancePolicyStatusList as [string, ...string[]]).optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
  framework: z.enum(GovernanceFrameworkList as [string, ...string[]]).optional(),
});

export const policyIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listRisksQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(GovernanceRiskStatusList as [string, ...string[]]).optional(),
  framework: z.enum(GovernanceFrameworkList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(GovernanceDefaults.maxLimit)
    .default(GovernanceDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createRiskBodySchema = z.object({
  organizationId: z.string().uuid(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9][a-z0-9._-]*$/i, "Invalid risk key"),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().min(2).max(64),
  framework: z.enum(GovernanceFrameworkList as [string, ...string[]]).optional().nullable(),
  likelihood: z
    .number()
    .int()
    .min(GovernanceDefaults.minLikelihood)
    .max(GovernanceDefaults.maxLikelihood),
  impact: z
    .number()
    .int()
    .min(GovernanceDefaults.minImpact)
    .max(GovernanceDefaults.maxImpact),
  residualLikelihood: z
    .number()
    .int()
    .min(GovernanceDefaults.minLikelihood)
    .max(GovernanceDefaults.maxLikelihood)
    .optional(),
  residualImpact: z
    .number()
    .int()
    .min(GovernanceDefaults.minImpact)
    .max(GovernanceDefaults.maxImpact)
    .optional(),
  mitigationEffectiveness: z.number().min(0).max(1).optional(),
  status: z.enum(GovernanceRiskStatusList as [string, ...string[]]).optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
  controlKeys: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
});

export const patchRiskBodySchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  category: z.string().trim().min(2).max(64).optional(),
  framework: z.enum(GovernanceFrameworkList as [string, ...string[]]).optional().nullable(),
  likelihood: z
    .number()
    .int()
    .min(GovernanceDefaults.minLikelihood)
    .max(GovernanceDefaults.maxLikelihood)
    .optional(),
  impact: z
    .number()
    .int()
    .min(GovernanceDefaults.minImpact)
    .max(GovernanceDefaults.maxImpact)
    .optional(),
  residualLikelihood: z
    .number()
    .int()
    .min(GovernanceDefaults.minLikelihood)
    .max(GovernanceDefaults.maxLikelihood)
    .optional(),
  residualImpact: z
    .number()
    .int()
    .min(GovernanceDefaults.minImpact)
    .max(GovernanceDefaults.maxImpact)
    .optional(),
  mitigationEffectiveness: z.number().min(0).max(1).optional(),
  status: z.enum(GovernanceRiskStatusList as [string, ...string[]]).optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
  controlKeys: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
});

export const riskIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const governanceReportsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(GovernanceDefaults.maxLimit)
    .default(GovernanceDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

// Used when seeding assessments from dashboard/report flows
export const assessmentStatusSchema = z.enum(
  GovernanceAssessmentStatusList as [string, ...string[]],
);
