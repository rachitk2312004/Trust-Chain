import { z } from "zod";
import { FeatureFlagStatuses, RoleKeys } from "@trustchain/config";

export const listUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const listOrganizationsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const userIdParamsSchema = z.object({
  userId: z.string().uuid(),
});

export const organizationIdParamsSchema = z.object({
  organizationId: z.string().uuid(),
});

export const adminReasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const patchAdminOrganizationBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    slug: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const patchAdminUserBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).nullable().optional(),
    lastName: z.string().trim().min(1).max(100).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const featureFlagIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const assignRoleBodySchema = z.object({
  userId: z.string().uuid(),
  roleKey: z.enum([
    RoleKeys.superAdmin,
    RoleKeys.orgAdmin,
    RoleKeys.employee,
    RoleKeys.publicUser,
  ] as [string, ...string[]]),
  organizationId: z.string().uuid().nullable().optional(),
});

export const revokeRoleBodySchema = assignRoleBodySchema;

export const assignPermissionsBodySchema = z.object({
  roleKey: z.string().min(1).max(64),
  capabilities: z.array(z.string().min(1).max(128)).max(100),
});

export const updateConfigurationBodySchema = z.object({
  key: z.string().min(1).max(128),
  value: z.any(),
  description: z.string().max(500).nullable().optional(),
});

export const createFeatureFlagBodySchema = z.object({
  organizationId: z.string().uuid().nullable().optional(),
  key: z
    .string()
    .trim()
    .min(2)
    .max(128)
    .regex(/^[a-z0-9._-]+$/i, "Feature key must be alphanumeric with . _ -"),
  status: z
    .enum([
      FeatureFlagStatuses.active,
      FeatureFlagStatuses.inactive,
      FeatureFlagStatuses.suspended,
    ] as [string, ...string[]])
    .optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  killSwitch: z.boolean().optional(),
  targeting: z.record(z.unknown()).nullable().optional(),
  experiments: z.record(z.unknown()).nullable().optional(),
});

export const patchFeatureFlagBodySchema = z.object({
  status: z
    .enum([
      FeatureFlagStatuses.active,
      FeatureFlagStatuses.inactive,
      FeatureFlagStatuses.suspended,
    ] as [string, ...string[]])
    .optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  killSwitch: z.boolean().optional(),
  targeting: z.record(z.unknown()).nullable().optional(),
  experiments: z.record(z.unknown()).nullable().optional(),
});

export const listAuditQuerySchema = z.object({
  action: z.string().trim().min(1).max(128).optional(),
  actorUserId: z.string().uuid().optional(),
  targetType: z.string().trim().min(1).max(64).optional(),
  success: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const configurationHistoryQuerySchema = z.object({
  key: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const configurationRollbackBodySchema = z.object({
  key: z.string().min(1).max(128),
  auditId: z.string().uuid(),
});

export const listFeatureFlagsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const analyticsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
});

export const operationsReprocessBodySchema = z.object({
  targets: z
    .array(
      z.enum([
        "tenants",
        "policies",
        "configuration",
        "audit",
        "diagnostics",
      ]),
    )
    .max(10)
    .optional(),
  tenantIds: z.array(z.string().uuid()).max(100).optional(),
  dryRun: z.boolean().optional().default(false),
});

export const operationsCleanupBodySchema = z.object({
  dryRun: z.boolean().optional().default(false),
  auditDays: z.number().int().min(1).max(3650).optional(),
  policyEventDays: z.number().int().min(1).max(3650).optional(),
  lifecycleEventDays: z.number().int().min(1).max(3650).optional(),
  configurationAuditDays: z.number().int().min(1).max(3650).optional(),
  diagnosticDays: z.number().int().min(1).max(3650).optional(),
});
