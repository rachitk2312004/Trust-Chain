import { z } from "zod";
import { TenantLifecycleStatusList } from "@trustchain/config";

export const listTenantsQuerySchema = z.object({
  search: z.string().trim().min(1).max(200).optional(),
  status: z.enum(TenantLifecycleStatusList as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const tenantIdParamsSchema = z.object({
  tenantId: z.string().uuid(),
});

const quotaLimitsSchema = z.object({
  users: z.number().int().min(0).max(1_000_000).optional(),
  organizations: z.number().int().min(0).max(1_000_000).optional(),
  documents: z.number().int().min(0).max(10_000_000).optional(),
  certificates: z.number().int().min(0).max(10_000_000).optional(),
  signatures: z.number().int().min(0).max(10_000_000).optional(),
  storageBytes: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
});

import { slugifyTenantName } from "./admin.tenants.workflow.js";

const slugFieldSchema = z
  .string()
  .trim()
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    const normalized = slugifyTenantName(val);
    return normalized || undefined;
  })
  .pipe(
    z
      .string()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
  );

export const createTenantBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200),
    slug: slugFieldSchema,
    ownerUserId: z.string().uuid().optional(),
    ownerEmail: z.string().trim().email().optional(),
    parentOrganizationId: z.string().uuid().nullable().optional(),
    quotas: quotaLimitsSchema.optional(),
  })
  .refine((body) => Boolean(body.ownerUserId || body.ownerEmail), {
    message: "Organization admin email or user id is required",
    path: ["ownerEmail"],
  });

export const patchTenantBodySchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    status: z.enum(TenantLifecycleStatusList as [string, ...string[]]).optional(),
    parentOrganizationId: z.string().uuid().nullable().optional(),
    quotas: quotaLimitsSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "At least one field is required" });

export const tenantReasonBodySchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
});

export const transferTenantBodySchema = z.object({
  toUserId: z.string().uuid(),
  toParentOrganizationId: z.string().uuid().nullable().optional(),
  reason: z.string().trim().min(1).max(500).optional(),
});
