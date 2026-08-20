import { z } from "zod";
import {
  IntegrationAuthModeList,
  IntegrationCategoryList,
  IntegrationConnectorKeyList,
  IntegrationDefaults,
  IntegrationStatusList,
} from "@trustchain/config";

export const integrationsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(IntegrationStatusList as [string, ...string[]]).optional(),
  connectorKey: z.enum(IntegrationConnectorKeyList as [string, ...string[]]).optional(),
  category: z.enum(IntegrationCategoryList as [string, ...string[]]).optional(),
});

export const createIntegrationBodySchema = z.object({
  organizationId: z.string().uuid(),
  connectorKey: z.enum(IntegrationConnectorKeyList as [string, ...string[]]),
  name: z.string().trim().min(2).max(120),
  authMode: z.enum(IntegrationAuthModeList as [string, ...string[]]).optional(),
  syncIntervalMinutes: z.number().int().min(5).max(10_080).optional(),
  syncMode: z.enum(["full", "incremental"]).optional(),
  scopes: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  config: z.record(z.unknown()).optional(),
  apiKey: z.string().trim().min(8).max(512).optional(),
  eventTypes: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
});

export const patchIntegrationBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  status: z.enum(IntegrationStatusList as [string, ...string[]]).optional(),
  syncIntervalMinutes: z.number().int().min(5).max(10_080).optional(),
  syncMode: z.enum(["full", "incremental"]).optional(),
  scopes: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  config: z.record(z.unknown()).optional(),
  eventTypes: z.array(z.string().trim().min(1).max(100)).max(20).optional(),
  rotateCredential: z.boolean().optional(),
});

export const integrationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const oauthBodySchema = z.object({
  organizationId: z.string().uuid(),
  integrationId: z.string().uuid(),
  action: z.enum(["start", "complete"]),
  redirectUri: z.string().url().optional(),
  clientId: z.string().trim().min(2).max(200).optional(),
  scopes: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
  state: z.string().trim().min(8).max(200).optional(),
  code: z.string().trim().min(4).max(512).optional(),
});

export const syncBodySchema = z.object({
  organizationId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  force: z.boolean().optional(),
  mode: z.enum(["full", "incremental"]).optional(),
});

export const eventsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  integrationId: z.string().uuid().optional(),
  eventType: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(IntegrationDefaults.maxLimit)
    .default(IntegrationDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});
