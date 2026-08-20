import { z } from "zod";
import {
  AdminPolicyStatusList,
  AdminPolicyTypeList,
} from "@trustchain/config";

const policyTypeSchema = z.enum(AdminPolicyTypeList as [string, ...string[]]);
const policyStatusSchema = z.enum(AdminPolicyStatusList as [string, ...string[]]);

export const listPoliciesQuerySchema = z.object({
  policyType: policyTypeSchema.optional(),
  status: policyStatusSchema.optional(),
  organizationId: z.string().uuid().optional(),
  search: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const policyIdParamsSchema = z.object({
  policyId: z.string().uuid(),
});

export const policyAssignmentInputSchema = z.object({
  organizationId: z.string().uuid(),
  inheritToChildren: z.boolean().optional().default(true),
  enabled: z.boolean().optional().default(true),
});

export const createPolicyBodySchema = z.object({
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
  policyType: policyTypeSchema,
  status: policyStatusSchema.optional().default("draft"),
  priority: z.number().int().min(0).max(10_000).optional().default(100),
  parentPolicyId: z.string().uuid().nullable().optional(),
  rules: z.record(z.unknown()),
  assignments: z.array(policyAssignmentInputSchema).max(50).optional(),
});

export const patchPolicyBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: policyStatusSchema.optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  parentPolicyId: z.string().uuid().nullable().optional(),
  rules: z.record(z.unknown()).optional(),
  assignments: z.array(policyAssignmentInputSchema).max(50).optional(),
});

export const evaluatePolicyBodySchema = z.object({
  organizationId: z.string().uuid().nullable().optional(),
  policyType: policyTypeSchema.optional(),
  includeGlobal: z.boolean().optional().default(true),
  context: z
    .object({
      capability: z.string().trim().min(1).max(200).optional(),
      resource: z.string().trim().min(1).max(64).optional(),
      usage: z.number().finite().min(0).optional(),
      featureKey: z.string().trim().min(1).max(200).optional(),
      retentionAgeDays: z.number().finite().min(0).optional(),
      workflowStep: z.string().trim().min(1).max(200).optional(),
      approvalCount: z.number().int().min(0).optional(),
      orgStatus: z.string().trim().min(1).max(64).optional(),
      childCount: z.number().int().min(0).optional(),
    })
    .default({}),
});
