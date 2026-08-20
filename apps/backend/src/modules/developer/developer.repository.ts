import { Prisma, prisma } from "@trustchain/database";
import {
  defaultApiKeyRateLimit,
  parseRateLimitConfig,
  resolveApiKeyStatus,
} from "./developer.keys.js";
import { parseRetryPolicy } from "./developer.webhooks.js";

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function toPublicApiKey(row: {
  id: string;
  organizationId: string;
  serviceAccountId: string | null;
  publicCode: string;
  name: string;
  keyPrefix: string;
  scopesJson: Prisma.JsonValue;
  status: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  rotatedFromId: string | null;
  revokedAt: Date | null;
  rateLimitJson: Prisma.JsonValue | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const status = resolveApiKeyStatus({ status: row.status, expiresAt: row.expiresAt });
  return {
    id: row.id,
    organizationId: row.organizationId,
    serviceAccountId: row.serviceAccountId,
    publicCode: row.publicCode,
    name: row.name,
    keyPrefix: row.keyPrefix,
    scopes: asStringArray(row.scopesJson),
    status,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    rotatedFromId: row.rotatedFromId,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    rateLimit: parseRateLimitConfig(row.rateLimitJson),
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicServiceAccount(row: {
  id: string;
  organizationId: string;
  publicCode: string;
  name: string;
  description: string | null;
  status: string;
  secretPrefix: string | null;
  lastRotatedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    publicCode: row.publicCode,
    name: row.name,
    description: row.description,
    status: row.status,
    secretPrefix: row.secretPrefix,
    lastRotatedAt: row.lastRotatedAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicWebhook(row: {
  id: string;
  organizationId: string;
  publicCode: string;
  name: string;
  url: string;
  secretPrefix: string;
  eventsJson: Prisma.JsonValue;
  status: string;
  retryPolicyJson: Prisma.JsonValue;
  failureCount: number;
  lastDeliveredAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    publicCode: row.publicCode,
    name: row.name,
    url: row.url,
    secretPrefix: row.secretPrefix,
    events: asStringArray(row.eventsJson),
    status: row.status,
    retryPolicy: parseRetryPolicy(row.retryPolicyJson),
    failureCount: row.failureCount,
    lastDeliveredAt: row.lastDeliveredAt?.toISOString() ?? null,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicDeliveryDetail(row: {
  id: string;
  webhookEndpointId: string;
  organizationId: string;
  eventType: string;
  payloadJson?: Prisma.JsonValue | null;
  status: string;
  attemptCount: number;
  nextRetryAt: Date | null;
  responseStatus: number | null;
  responseBody?: string | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...toPublicDelivery(row),
    payload: row.payloadJson ?? null,
    responseBody: row.responseBody ?? null,
  };
}

export function toPublicDelivery(row: {
  id: string;
  webhookEndpointId: string;
  organizationId: string;
  eventType: string;
  status: string;
  attemptCount: number;
  nextRetryAt: Date | null;
  responseStatus: number | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    webhookEndpointId: row.webhookEndpointId,
    organizationId: row.organizationId,
    eventType: row.eventType,
    status: row.status,
    attemptCount: row.attemptCount,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    responseStatus: row.responseStatus,
    error: row.error,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listApiKeys(input: {
  organizationId: string;
  status?: string;
  serviceAccountId?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ApiKeyWhereInput = { organizationId: input.organizationId };
  if (input.status) where.status = input.status;
  if (input.serviceAccountId) where.serviceAccountId = input.serviceAccountId;

  const [rows, total] = await Promise.all([
    prisma.apiKey.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.apiKey.count({ where }),
  ]);
  return { items: rows, total };
}

export async function getApiKey(keyId: string) {
  return prisma.apiKey.findUnique({ where: { id: keyId } });
}

export async function createApiKey(input: {
  organizationId: string;
  serviceAccountId?: string | null;
  publicCode: string;
  name: string;
  keyPrefix: string;
  keyHash: string;
  scopes: string[];
  expiresAt?: Date | null;
  rateLimit?: { maxRequests: number; windowMs: number } | null;
  createdById: string;
  rotatedFromId?: string | null;
}) {
  return prisma.apiKey.create({
    data: {
      organizationId: input.organizationId,
      serviceAccountId: input.serviceAccountId ?? null,
      publicCode: input.publicCode,
      name: input.name,
      keyPrefix: input.keyPrefix,
      keyHash: input.keyHash,
      scopesJson: input.scopes,
      expiresAt: input.expiresAt ?? null,
      rateLimitJson: (input.rateLimit ?? defaultApiKeyRateLimit()) as Prisma.InputJsonValue,
      createdById: input.createdById,
      rotatedFromId: input.rotatedFromId ?? null,
    },
  });
}

export async function updateApiKey(
  keyId: string,
  data: Prisma.ApiKeyUpdateInput,
) {
  return prisma.apiKey.update({ where: { id: keyId }, data });
}

export async function deleteApiKey(keyId: string) {
  return prisma.apiKey.delete({ where: { id: keyId } });
}

export async function listServiceAccounts(input: {
  organizationId: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ServiceAccountWhereInput = {
    organizationId: input.organizationId,
  };
  if (input.status) where.status = input.status;
  const [rows, total] = await Promise.all([
    prisma.serviceAccount.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.serviceAccount.count({ where }),
  ]);
  return { items: rows, total };
}

export async function getServiceAccount(serviceAccountId: string) {
  return prisma.serviceAccount.findUnique({ where: { id: serviceAccountId } });
}

export async function createServiceAccount(input: {
  organizationId: string;
  publicCode: string;
  name: string;
  description?: string | null;
  secretHash: string;
  secretPrefix: string;
  createdById: string;
}) {
  return prisma.serviceAccount.create({
    data: {
      organizationId: input.organizationId,
      publicCode: input.publicCode,
      name: input.name,
      description: input.description ?? null,
      secretHash: input.secretHash,
      secretPrefix: input.secretPrefix,
      lastRotatedAt: new Date(),
      createdById: input.createdById,
    },
  });
}

export async function updateServiceAccount(
  serviceAccountId: string,
  data: Prisma.ServiceAccountUpdateInput,
) {
  return prisma.serviceAccount.update({ where: { id: serviceAccountId }, data });
}

export async function listWebhooks(input: {
  organizationId: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.WebhookEndpointWhereInput = {
    organizationId: input.organizationId,
  };
  if (input.status) where.status = input.status;
  const [rows, total] = await Promise.all([
    prisma.webhookEndpoint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.webhookEndpoint.count({ where }),
  ]);
  return { items: rows, total };
}

export async function getWebhook(webhookId: string) {
  return prisma.webhookEndpoint.findUnique({ where: { id: webhookId } });
}

export async function createWebhook(input: {
  organizationId: string;
  publicCode: string;
  name: string;
  url: string;
  secretHash: string;
  secretPrefix: string;
  events: string[];
  retryPolicy: Record<string, unknown>;
  createdById: string;
}) {
  return prisma.webhookEndpoint.create({
    data: {
      organizationId: input.organizationId,
      publicCode: input.publicCode,
      name: input.name,
      url: input.url,
      secretHash: input.secretHash,
      secretPrefix: input.secretPrefix,
      eventsJson: input.events,
      retryPolicyJson: input.retryPolicy as Prisma.InputJsonValue,
      createdById: input.createdById,
    },
  });
}

export async function updateWebhook(
  webhookId: string,
  data: Prisma.WebhookEndpointUpdateInput,
) {
  return prisma.webhookEndpoint.update({ where: { id: webhookId }, data });
}

export async function deleteWebhook(webhookId: string) {
  return prisma.webhookEndpoint.delete({ where: { id: webhookId } });
}

export async function listWebhookDeliveries(input: {
  webhookEndpointId: string;
  limit?: number;
}) {
  return prisma.webhookDelivery.findMany({
    where: { webhookEndpointId: input.webhookEndpointId },
    orderBy: { createdAt: "desc" },
    take: input.limit ?? 20,
  });
}

export async function createWebhookDelivery(input: {
  webhookEndpointId: string;
  organizationId: string;
  eventType: string;
  payload?: unknown;
  status: string;
}) {
  return prisma.webhookDelivery.create({
    data: {
      webhookEndpointId: input.webhookEndpointId,
      organizationId: input.organizationId,
      eventType: input.eventType,
      payloadJson: input.payload as Prisma.InputJsonValue | undefined,
      status: input.status,
      attemptCount: 0,
    },
  });
}

export async function countDeveloperResources(organizationId: string) {
  const [keys, webhooks, serviceAccounts, deliveries] = await Promise.all([
    prisma.apiKey.count({ where: { organizationId } }),
    prisma.webhookEndpoint.count({ where: { organizationId } }),
    prisma.serviceAccount.count({ where: { organizationId } }),
    prisma.webhookDelivery.count({ where: { organizationId } }),
  ]);
  return { keys, webhooks, serviceAccounts, deliveries };
}
