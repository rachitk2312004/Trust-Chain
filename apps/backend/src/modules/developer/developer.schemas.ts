import { z } from "zod";
import {
  ApiKeyScopeList,
  ApiKeyStatusList,
  ServiceAccountStatusList,
  WebhookEndpointStatusList,
} from "@trustchain/config";

export const organizationIdQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const listKeysQuerySchema = organizationIdQuerySchema.extend({
  status: z.enum(ApiKeyStatusList as [string, ...string[]]).optional(),
  serviceAccountId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const keyIdParamsSchema = z.object({
  keyId: z.string().uuid(),
});

export const createKeyBodySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  scopes: z.array(z.enum(ApiKeyScopeList as [string, ...string[]])).max(20).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  serviceAccountId: z.string().uuid().nullable().optional(),
  environment: z.enum(["live", "test"]).optional().default("live"),
  rateLimit: z
    .object({
      maxRequests: z.number().int().min(1).max(1_000_000).optional(),
      windowMs: z.number().int().min(1000).max(86_400_000).optional(),
    })
    .optional(),
});

export const patchKeyBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  scopes: z.array(z.enum(ApiKeyScopeList as [string, ...string[]])).max(20).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  status: z.enum(["active", "revoked"] as [string, ...string[]]).optional(),
  rotate: z.boolean().optional(),
  rateLimit: z
    .object({
      maxRequests: z.number().int().min(1).max(1_000_000).optional(),
      windowMs: z.number().int().min(1000).max(86_400_000).optional(),
    })
    .nullable()
    .optional(),
});

export const listWebhooksQuerySchema = organizationIdQuerySchema.extend({
  status: z.enum(WebhookEndpointStatusList as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const webhookIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createWebhookBodySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  url: z.string().url().max(2000),
  events: z.array(z.string().trim().min(1).max(128)).max(50).optional(),
  retryPolicy: z
    .object({
      maxAttempts: z.number().int().min(1).max(20).optional(),
      initialDelayMs: z.number().int().min(100).max(3_600_000).optional(),
      maxDelayMs: z.number().int().min(1000).max(86_400_000).optional(),
      backoffMultiplier: z.number().min(1).max(10).optional(),
    })
    .optional(),
});

export const patchWebhookBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  url: z.string().url().max(2000).optional(),
  events: z.array(z.string().trim().min(1).max(128)).max(50).optional(),
  status: z.enum(WebhookEndpointStatusList as [string, ...string[]]).optional(),
  retryPolicy: z
    .object({
      maxAttempts: z.number().int().min(1).max(20).optional(),
      initialDelayMs: z.number().int().min(100).max(3_600_000).optional(),
      maxDelayMs: z.number().int().min(1000).max(86_400_000).optional(),
      backoffMultiplier: z.number().min(1).max(10).optional(),
    })
    .optional(),
  rotateSecret: z.boolean().optional(),
});

export const listServiceAccountsQuerySchema = organizationIdQuerySchema.extend({
  status: z.enum(ServiceAccountStatusList as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const serviceAccountIdParamsSchema = z.object({
  serviceAccountId: z.string().uuid(),
});

export const createServiceAccountBodySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().trim().min(2).max(200),
  description: z.string().trim().max(2000).nullable().optional(),
});

export const patchServiceAccountBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(["active", "suspended"] as [string, ...string[]]).optional(),
  rotate: z.boolean().optional(),
});

export const developerDashboardQuerySchema = organizationIdQuerySchema;

export const usageQuerySchema = organizationIdQuerySchema.extend({
  days: z.coerce.number().int().min(1).max(90).default(30),
  apiKeyId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const analyticsQuerySchema = organizationIdQuerySchema.extend({
  days: z.coerce.number().int().min(1).max(90).default(30),
});

export const auditQuerySchema = organizationIdQuerySchema.extend({
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
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const quotaIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const patchQuotaBodySchema = z.object({
  requestsPerDay: z.number().int().min(1).max(10_000_000).optional(),
  requestsPerMonth: z.number().int().min(1).max(100_000_000).optional(),
  maxApiKeys: z.number().int().min(1).max(10_000).optional(),
  maxWebhooks: z.number().int().min(1).max(10_000).optional(),
  maxServiceAccounts: z.number().int().min(1).max(10_000).optional(),
});

export const deliveryIdParamsSchema = z.object({
  id: z.string().uuid(),
  deliveryId: z.string().uuid(),
});

export const listDeliveriesQuerySchema = z.object({
  status: z.string().trim().min(1).max(32).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const testWebhookBodySchema = z.object({
  eventType: z.string().trim().min(1).max(128).optional(),
  data: z.record(z.unknown()).optional(),
  dispatch: z.boolean().optional().default(true),
});

export const replayWebhookBodySchema = z.object({
  deliveryId: z.string().uuid(),
  dispatch: z.boolean().optional().default(true),
});
