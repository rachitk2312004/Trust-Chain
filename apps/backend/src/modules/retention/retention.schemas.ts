import { z } from "zod";
import {
  LegalHoldStatusList,
  RetentionDefaults,
  RetentionDispositionActionList,
  RetentionPolicyStatusList,
  RetentionTargetTypeList,
} from "@trustchain/config";

const targetTypeSchema = z.enum(RetentionTargetTypeList as [string, ...string[]]);

export const retentionOrgQuerySchema = z.object({
  organizationId: z.string().uuid(),
  targetType: targetTypeSchema.optional(),
  status: z.enum(RetentionPolicyStatusList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RetentionDefaults.maxLimit)
    .default(RetentionDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createRetentionPolicyBodySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  targetType: targetTypeSchema,
  retentionDays: z
    .number()
    .int()
    .min(RetentionDefaults.minRetentionDays)
    .max(RetentionDefaults.maxRetentionDays)
    .default(RetentionDefaults.defaultRetentionDays),
  disposition: z.enum(RetentionDispositionActionList as [string, ...string[]]),
  status: z.enum(RetentionPolicyStatusList as [string, ...string[]]).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
});

export const patchRetentionPolicyBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  retentionDays: z
    .number()
    .int()
    .min(RetentionDefaults.minRetentionDays)
    .max(RetentionDefaults.maxRetentionDays)
    .optional(),
  disposition: z.enum(RetentionDispositionActionList as [string, ...string[]]).optional(),
  status: z.enum(RetentionPolicyStatusList as [string, ...string[]]).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
});

export const retentionPolicyIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const legalHoldListQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(LegalHoldStatusList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RetentionDefaults.maxLimit)
    .default(RetentionDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createLegalHoldBodySchema = z
  .object({
    organizationId: z.string().uuid(),
    name: z.string().trim().min(2).max(200),
    reason: z.string().trim().min(2).max(4000),
    scope: z.enum(["all", "target_type", "targets"]).default("all"),
    targetType: targetTypeSchema.optional().nullable(),
    targetIds: z.array(z.string().trim().min(1).max(128)).max(500).optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.scope === "target_type" && !val.targetType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetType required when scope is target_type",
        path: ["targetType"],
      });
    }
    if (val.scope === "targets" && !(val.targetIds && val.targetIds.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetIds required when scope is targets",
        path: ["targetIds"],
      });
    }
  });

export const patchLegalHoldBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  reason: z.string().trim().min(2).max(4000).optional(),
  status: z.enum(LegalHoldStatusList as [string, ...string[]]).optional(),
  endsAt: z.string().datetime().optional().nullable(),
  targetIds: z.array(z.string().trim().min(1).max(128)).max(500).optional(),
});

export const legalHoldIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const runRetentionBodySchema = z.object({
  organizationId: z.string().uuid(),
  dryRun: z.boolean().optional().default(false),
  targetType: targetTypeSchema.optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(RetentionDefaults.maxRunBatch)
    .optional()
    .default(RetentionDefaults.maxRunBatch),
});

export const retentionStatusQuerySchema = z.object({
  organizationId: z.string().uuid(),
});
