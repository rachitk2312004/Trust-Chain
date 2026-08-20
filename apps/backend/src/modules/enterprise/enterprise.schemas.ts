import { z } from "zod";
import {
  EnterpriseAccessReviewDecisions,
  EnterpriseDefaults,
  EnterpriseRoleStatusList,
  EnterpriseSamlStatusList,
  EnterpriseScimStatusList,
} from "@trustchain/config";

export const enterpriseOrgQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const upsertSamlBodySchema = z.object({
  organizationId: z.string().uuid(),
  entityId: z.string().trim().min(3).max(500),
  acsUrl: z.string().url().max(1000),
  idpEntityId: z.string().trim().min(3).max(500),
  idpSsoUrl: z.string().url().max(1000),
  idpCertificatePem: z.string().trim().min(32).max(20_000),
  attributeMapping: z
    .object({
      email: z.string().trim().min(1).max(100).optional(),
      firstName: z.string().trim().min(1).max(100).optional(),
      lastName: z.string().trim().min(1).max(100).optional(),
      groups: z.string().trim().min(1).max(100).optional(),
      department: z.string().trim().min(1).max(100).optional(),
    })
    .optional()
    .nullable(),
  status: z.enum(EnterpriseSamlStatusList as [string, ...string[]]).optional(),
  /// Optional: also start an access review after enabling SSO
  startAccessReview: z.boolean().optional(),
});

export const upsertScimBodySchema = z.object({
  organizationId: z.string().uuid(),
  baseUrl: z.string().url().max(1000),
  status: z.enum(EnterpriseScimStatusList as [string, ...string[]]).optional(),
  userMapping: z.record(z.string(), z.string()).optional().nullable(),
  rotateToken: z.boolean().optional().default(true),
  /// Optional SCIM user provisioning payload for foundation testing/ops
  provisionUser: z
    .object({
      userName: z.string().trim().min(1).max(320),
      active: z.boolean().optional(),
      name: z
        .object({
          givenName: z.string().trim().max(100).optional(),
          familyName: z.string().trim().max(100).optional(),
        })
        .optional(),
      emails: z
        .array(z.object({ value: z.string().email(), primary: z.boolean().optional() }))
        .optional(),
      externalId: z.string().trim().max(200).optional(),
      department: z.string().trim().max(200).optional(),
      title: z.string().trim().max(200).optional(),
    })
    .optional(),
});

export const enterpriseRolesQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(EnterpriseRoleStatusList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(EnterpriseDefaults.maxLimit)
    .default(EnterpriseDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createEnterpriseRoleBodySchema = z.object({
  organizationId: z.string().uuid(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z][a-z0-9_]*$/),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  parentRoleId: z.string().uuid().optional().nullable(),
  permissions: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  status: z.enum(EnterpriseRoleStatusList as [string, ...string[]]).optional(),
  /// Optional ABAC policy seed
  abac: z
    .object({
      name: z.string().trim().min(2).max(200),
      effect: z.enum(["allow", "deny"]),
      rules: z
        .array(
          z.object({
            attribute: z.string().trim().min(1).max(100),
            operator: z.enum(["eq", "neq", "in", "contains"]),
            value: z.union([z.string(), z.array(z.string())]),
          }),
        )
        .min(1)
        .max(EnterpriseDefaults.maxAbacRules),
      resourceType: z.string().trim().max(100).optional().nullable(),
      priority: z.number().int().min(0).max(10_000).optional(),
    })
    .optional(),
  /// Optional delegated admin grant
  delegateUserId: z.string().uuid().optional(),
  delegateScope: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
});

export const patchEnterpriseRoleBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  parentRoleId: z.string().uuid().optional().nullable(),
  permissions: z.array(z.string().trim().min(1).max(100)).max(100).optional(),
  status: z.enum(EnterpriseRoleStatusList as [string, ...string[]]).optional(),
  /// Complete an access review item while updating roles
  accessReviewItemId: z.string().uuid().optional(),
  accessReviewDecision: z
    .enum([
      EnterpriseAccessReviewDecisions.approve,
      EnterpriseAccessReviewDecisions.revoke,
    ] as [string, ...string[]])
    .optional(),
  accessReviewNotes: z.string().trim().max(2000).optional().nullable(),
});

export const enterpriseRoleIdParamsSchema = z.object({
  id: z.string().uuid(),
});
