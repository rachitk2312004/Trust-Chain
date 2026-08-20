import { z } from "zod";
import {
  ComplianceDefaults,
  ComplianceFrameworkList,
  ComplianceRemediationStatuses,
  ComplianceViolationStatuses,
} from "@trustchain/config";

const frameworkSchema = z.enum(ComplianceFrameworkList as [string, ...string[]]);

export const complianceListQuerySchema = z.object({
  organizationId: z.string().uuid(),
  framework: frameworkSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ComplianceDefaults.maxLimit)
    .default(ComplianceDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const complianceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const complianceRunBodySchema = z.object({
  organizationId: z.string().uuid(),
  framework: frameworkSchema,
  scheduled: z.boolean().optional().default(false),
  /** Optional signal overrides for foundation / testing. */
  signals: z
    .record(z.string(), z.number())
    .optional(),
});

export const complianceReportsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  framework: frameworkSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ComplianceDefaults.maxLimit)
    .default(ComplianceDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const complianceFrameworksQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const patchRemediationBodySchema = z.object({
  status: z
    .enum(
      Object.values(ComplianceRemediationStatuses) as [string, ...string[]],
    )
    .optional(),
  notes: z.string().trim().max(2000).optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
});

export const patchViolationBodySchema = z.object({
  status: z
    .enum(Object.values(ComplianceViolationStatuses) as [string, ...string[]])
    .optional(),
});
