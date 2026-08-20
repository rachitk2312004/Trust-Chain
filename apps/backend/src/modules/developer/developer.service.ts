import {
  ApiKeyStatuses,
  DeveloperIdPrefixes,
  DeveloperSdkMetadata,
  ServiceAccountStatuses,
  WebhookDeliveryStatuses,
} from "@trustchain/config";
import { generateOpaqueToken } from "../../lib/crypto.js";
import { AppError } from "../../lib/errors.js";
import { assertDeveloperAdmin, hashDeveloperSecret } from "./developer.auth.js";
import {
  createReplayDelivery,
  createTestDelivery,
  getDelivery,
  listDeliveriesForWebhook,
} from "./developer.delivery.js";
import { dispatchDelivery } from "./developer.dispatcher.js";
import {
  getUsageMetrics,
  listApiUsageEvents,
  toPublicUsageEvent,
} from "./developer.metrics.js";
import {
  canRevokeApiKey,
  canRotateApiKey,
  defaultApiKeyRateLimit,
  generateApiKeyMaterial,
  generatePublicCode,
  normalizeScopes,
} from "./developer.keys.js";
import {
  assertDeveloperKeyCreateLimit,
  assertDeveloperServiceAccountCreateLimit,
  assertDeveloperWebhookCreateLimit,
} from "./developer.ratelimit.js";
import * as repo from "./developer.repository.js";
import {
  defaultRetryPolicy,
  generateWebhookPublicCode,
  generateWebhookSecret,
  normalizeWebhookEvents,
} from "./developer.webhooks.js";

export async function getDeveloperDashboard(actorId: string, organizationId: string) {
  await assertDeveloperAdmin(actorId, organizationId);
  const counts = await repo.countDeveloperResources(organizationId);
  return {
    organizationId,
    counts,
    sdk: DeveloperSdkMetadata,
    generatedAt: new Date().toISOString(),
  };
}

export async function getDeveloperSdkMetadata(actorId: string, organizationId: string) {
  await assertDeveloperAdmin(actorId, organizationId);
  return {
    sdk: {
      ...DeveloperSdkMetadata,
      openapi: {
        json: "/api/v1/developer/openapi.json",
        yaml: "/api/v1/developer/openapi.yaml",
      },
    },
  };
}

export async function getOpenApiJson(actorId: string, organizationId: string) {
  await assertDeveloperAdmin(actorId, organizationId);
  const { buildPublicOpenApiDocument } = await import("./developer.openapi.js");
  return buildPublicOpenApiDocument();
}

export async function getOpenApiYaml(actorId: string, organizationId: string) {
  await assertDeveloperAdmin(actorId, organizationId);
  const { renderOpenApiYaml } = await import("./developer.codegen.js");
  const { buildPublicOpenApiDocument } = await import("./developer.openapi.js");
  return renderOpenApiYaml(buildPublicOpenApiDocument());
}

export async function listApiKeys(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    serviceAccountId?: string;
    limit: number;
    offset: number;
  },
) {
  await assertDeveloperAdmin(actorId, query.organizationId);
  const { items, total } = await repo.listApiKeys(query);
  return {
    keys: items.map(repo.toPublicApiKey),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createApiKey(
  actorId: string,
  input: {
    organizationId: string;
    name: string;
    scopes?: string[];
    expiresAt?: string | null;
    serviceAccountId?: string | null;
    environment?: "live" | "test";
    rateLimit?: { maxRequests?: number; windowMs?: number };
  },
) {
  await assertDeveloperAdmin(actorId, input.organizationId);
  await assertDeveloperKeyCreateLimit(input.organizationId);
  const { assertOrganizationResourceQuota } = await import("./developer.quotas.js");
  await assertOrganizationResourceQuota(input.organizationId, "maxApiKeys");

  if (input.serviceAccountId) {
    const sa = await repo.getServiceAccount(input.serviceAccountId);
    if (!sa || sa.organizationId !== input.organizationId) {
      throw new AppError(404, "NOT_FOUND", "Service account not found");
    }
    if (sa.status === ServiceAccountStatuses.suspended) {
      throw new AppError(400, "VALIDATION_ERROR", "Service account is suspended");
    }
  }

  const material = generateApiKeyMaterial({ environment: input.environment });
  const row = await repo.createApiKey({
    organizationId: input.organizationId,
    serviceAccountId: input.serviceAccountId,
    publicCode: material.publicCode,
    name: input.name,
    keyPrefix: material.keyPrefix,
    keyHash: material.keyHash,
    scopes: normalizeScopes(input.scopes),
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    rateLimit: defaultApiKeyRateLimit(input.rateLimit),
    createdById: actorId,
  });

  return {
    key: repo.toPublicApiKey(row),
    secret: material.plaintext,
  };
}

export async function patchApiKey(
  actorId: string,
  keyId: string,
  input: {
    name?: string;
    scopes?: string[];
    expiresAt?: string | null;
    status?: string;
    rotate?: boolean;
    rateLimit?: { maxRequests?: number; windowMs?: number } | null;
  },
) {
  const existing = await repo.getApiKey(keyId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "API key not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  if (input.rotate) {
    if (!canRotateApiKey(existing.status)) {
      throw new AppError(400, "VALIDATION_ERROR", `Cannot rotate key in status '${existing.status}'`);
    }
    const material = generateApiKeyMaterial({
      environment: existing.keyPrefix.startsWith("tc_test") ? "test" : "live",
    });
    const created = await repo.createApiKey({
      organizationId: existing.organizationId,
      serviceAccountId: existing.serviceAccountId,
      publicCode: material.publicCode,
      name: input.name ?? existing.name,
      keyPrefix: material.keyPrefix,
      keyHash: material.keyHash,
      scopes: input.scopes ? normalizeScopes(input.scopes) : (existing.scopesJson as string[]),
      expiresAt:
        input.expiresAt === undefined
          ? existing.expiresAt
          : input.expiresAt
            ? new Date(input.expiresAt)
            : null,
      rateLimit: input.rateLimit === undefined
        ? defaultApiKeyRateLimit(existing.rateLimitJson as object)
        : input.rateLimit === null
          ? defaultApiKeyRateLimit()
          : defaultApiKeyRateLimit(input.rateLimit),
      createdById: actorId,
      rotatedFromId: existing.id,
    });
    await repo.updateApiKey(existing.id, {
      status: ApiKeyStatuses.rotated,
      revokedAt: new Date(),
    });
    return {
      key: repo.toPublicApiKey(created),
      secret: material.plaintext,
      rotatedFromId: existing.id,
    };
  }

  if (input.status === ApiKeyStatuses.revoked) {
    if (!canRevokeApiKey(existing.status) && existing.status !== ApiKeyStatuses.revoked) {
      throw new AppError(400, "VALIDATION_ERROR", `Cannot revoke key in status '${existing.status}'`);
    }
  }

  const updated = await repo.updateApiKey(keyId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.scopes !== undefined ? { scopesJson: normalizeScopes(input.scopes) } : {}),
    ...(input.expiresAt !== undefined
      ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
      : {}),
    ...(input.status === ApiKeyStatuses.revoked
      ? { status: ApiKeyStatuses.revoked, revokedAt: new Date() }
      : input.status === ApiKeyStatuses.active
        ? { status: ApiKeyStatuses.active, revokedAt: null }
        : {}),
    ...(input.rateLimit !== undefined
      ? {
          rateLimitJson:
            input.rateLimit === null
              ? defaultApiKeyRateLimit()
              : defaultApiKeyRateLimit(input.rateLimit),
        }
      : {}),
  });

  return { key: repo.toPublicApiKey(updated) };
}

export async function deleteApiKey(actorId: string, keyId: string) {
  const existing = await repo.getApiKey(keyId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "API key not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  if (existing.status === ApiKeyStatuses.active) {
    await repo.updateApiKey(keyId, {
      status: ApiKeyStatuses.revoked,
      revokedAt: new Date(),
    });
    return { deleted: false, revoked: true, keyId };
  }

  await repo.deleteApiKey(keyId);
  return { deleted: true, revoked: false, keyId };
}

export async function listWebhooks(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    limit: number;
    offset: number;
  },
) {
  await assertDeveloperAdmin(actorId, query.organizationId);
  const { items, total } = await repo.listWebhooks(query);
  return {
    webhooks: items.map(repo.toPublicWebhook),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createWebhook(
  actorId: string,
  input: {
    organizationId: string;
    name: string;
    url: string;
    events?: string[];
    retryPolicy?: {
      maxAttempts?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      backoffMultiplier?: number;
    };
  },
) {
  await assertDeveloperAdmin(actorId, input.organizationId);
  await assertDeveloperWebhookCreateLimit(input.organizationId);
  const { assertOrganizationResourceQuota: assertWebhookQuota } = await import(
    "./developer.quotas.js"
  );
  await assertWebhookQuota(input.organizationId, "maxWebhooks");

  const secret = generateWebhookSecret();
  const retryPolicy = defaultRetryPolicy(input.retryPolicy);
  const row = await repo.createWebhook({
    organizationId: input.organizationId,
    publicCode: generateWebhookPublicCode(),
    name: input.name,
    url: input.url,
    secretHash: secret.secretHash,
    secretPrefix: secret.secretPrefix,
    events: normalizeWebhookEvents(input.events),
    retryPolicy,
    createdById: actorId,
  });

  // Foundation delivery log entry for registration (no outbound dispatch).
  const delivery = await repo.createWebhookDelivery({
    webhookEndpointId: row.id,
    organizationId: input.organizationId,
    eventType: "webhook.registered",
    payload: { webhookId: row.id, url: row.url },
    status: WebhookDeliveryStatuses.pending,
  });

  return {
    webhook: repo.toPublicWebhook(row),
    secret: secret.plaintext,
    delivery: repo.toPublicDelivery(delivery),
  };
}

export async function patchWebhook(
  actorId: string,
  webhookId: string,
  input: {
    name?: string;
    url?: string;
    events?: string[];
    status?: string;
    retryPolicy?: {
      maxAttempts?: number;
      initialDelayMs?: number;
      maxDelayMs?: number;
      backoffMultiplier?: number;
    };
    rotateSecret?: boolean;
  },
) {
  const existing = await repo.getWebhook(webhookId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Webhook not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  let secretPlaintext: string | undefined;
  let secretHash = existing.secretHash;
  let secretPrefix = existing.secretPrefix;
  if (input.rotateSecret) {
    const secret = generateWebhookSecret();
    secretPlaintext = secret.plaintext;
    secretHash = secret.secretHash;
    secretPrefix = secret.secretPrefix;
  }

  const updated = await repo.updateWebhook(webhookId, {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.url !== undefined ? { url: input.url } : {}),
    ...(input.events !== undefined ? { eventsJson: normalizeWebhookEvents(input.events) } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.retryPolicy !== undefined
      ? { retryPolicyJson: defaultRetryPolicy(input.retryPolicy) }
      : {}),
    ...(input.rotateSecret
      ? { secretHash, secretPrefix }
      : {}),
  });

  const deliveries = await repo.listWebhookDeliveries({
    webhookEndpointId: webhookId,
    limit: 10,
  });

  return {
    webhook: repo.toPublicWebhook(updated),
    ...(secretPlaintext ? { secret: secretPlaintext } : {}),
    deliveries: deliveries.map(repo.toPublicDelivery),
  };
}

export async function deleteWebhook(actorId: string, webhookId: string) {
  const existing = await repo.getWebhook(webhookId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Webhook not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);
  await repo.deleteWebhook(webhookId);
  return { deleted: true, webhookId };
}

export async function listServiceAccounts(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    limit: number;
    offset: number;
  },
) {
  await assertDeveloperAdmin(actorId, query.organizationId);
  const { items, total } = await repo.listServiceAccounts(query);
  return {
    serviceAccounts: items.map(repo.toPublicServiceAccount),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function createServiceAccount(
  actorId: string,
  input: {
    organizationId: string;
    name: string;
    description?: string | null;
  },
) {
  await assertDeveloperAdmin(actorId, input.organizationId);
  await assertDeveloperServiceAccountCreateLimit(input.organizationId);
  const { assertOrganizationResourceQuota: assertSaQuota } = await import("./developer.quotas.js");
  await assertSaQuota(input.organizationId, "maxServiceAccounts");

  const plaintext = `sa_sec_${generateOpaqueToken(24)}`;
  const row = await repo.createServiceAccount({
    organizationId: input.organizationId,
    publicCode: generatePublicCode(DeveloperIdPrefixes.serviceAccount),
    name: input.name,
    description: input.description,
    secretHash: hashDeveloperSecret(plaintext),
    secretPrefix: plaintext.slice(0, 12),
    createdById: actorId,
  });

  return {
    serviceAccount: repo.toPublicServiceAccount(row),
    secret: plaintext,
  };
}

export async function patchServiceAccount(
  actorId: string,
  serviceAccountId: string,
  input: {
    name?: string;
    description?: string | null;
    status?: string;
    rotate?: boolean;
  },
) {
  const existing = await repo.getServiceAccount(serviceAccountId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Service account not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  let secretPlaintext: string | undefined;
  const data: Parameters<typeof repo.updateServiceAccount>[1] = {
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };

  if (input.rotate) {
    const plaintext = `sa_sec_${generateOpaqueToken(24)}`;
    secretPlaintext = plaintext;
    data.secretHash = hashDeveloperSecret(plaintext);
    data.secretPrefix = plaintext.slice(0, 12);
    data.lastRotatedAt = new Date();
    if (existing.status === ServiceAccountStatuses.rotated) {
      data.status = ServiceAccountStatuses.active;
    }
  }

  const updated = await repo.updateServiceAccount(serviceAccountId, data);
  return {
    serviceAccount: repo.toPublicServiceAccount(updated),
    ...(secretPlaintext ? { secret: secretPlaintext } : {}),
  };
}

export async function testWebhook(
  actorId: string,
  webhookId: string,
  input: {
    eventType?: string;
    data?: Record<string, unknown>;
    dispatch?: boolean;
  },
) {
  const existing = await repo.getWebhook(webhookId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Webhook not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  const delivery = await createTestDelivery({
    organizationId: existing.organizationId,
    webhookEndpointId: webhookId,
    eventType: input.eventType,
    data: input.data,
  });

  let dispatchResult = null;
  if (input.dispatch !== false) {
    dispatchResult = await dispatchDelivery(delivery.id);
  }

  const refreshed = await getDelivery(delivery.id);
  return {
    delivery: repo.toPublicDeliveryDetail(refreshed ?? delivery),
    dispatch: dispatchResult,
  };
}

export async function replayWebhookDelivery(
  actorId: string,
  webhookId: string,
  input: { deliveryId: string; dispatch?: boolean },
) {
  const existing = await repo.getWebhook(webhookId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Webhook not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  const source = await getDelivery(input.deliveryId);
  if (
    !source ||
    source.webhookEndpointId !== webhookId ||
    source.organizationId !== existing.organizationId
  ) {
    throw new AppError(404, "NOT_FOUND", "Delivery not found");
  }

  const delivery = await createReplayDelivery(source);
  let dispatchResult = null;
  if (input.dispatch !== false) {
    dispatchResult = await dispatchDelivery(delivery.id);
  }

  const refreshed = await getDelivery(delivery.id);
  return {
    delivery: repo.toPublicDeliveryDetail(refreshed ?? delivery),
    sourceDeliveryId: source.id,
    dispatch: dispatchResult,
  };
}

export async function listWebhookDeliveries(
  actorId: string,
  webhookId: string,
  query: { status?: string; limit: number; offset: number },
) {
  const existing = await repo.getWebhook(webhookId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Webhook not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  const { items, total } = await listDeliveriesForWebhook({
    webhookEndpointId: webhookId,
    organizationId: existing.organizationId,
    status: query.status,
    limit: query.limit,
    offset: query.offset,
  });

  return {
    deliveries: items.map((d) => repo.toPublicDelivery(d)),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function getWebhookDelivery(
  actorId: string,
  webhookId: string,
  deliveryId: string,
) {
  const existing = await repo.getWebhook(webhookId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Webhook not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  const delivery = await getDelivery(deliveryId);
  if (
    !delivery ||
    delivery.webhookEndpointId !== webhookId ||
    delivery.organizationId !== existing.organizationId
  ) {
    throw new AppError(404, "NOT_FOUND", "Delivery not found");
  }

  return {
    delivery: repo.toPublicDeliveryDetail(delivery),
    webhook: repo.toPublicWebhook(existing),
  };
}

export async function getWebhookDetail(actorId: string, webhookId: string) {
  const existing = await repo.getWebhook(webhookId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Webhook not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);

  const { items, total } = await listDeliveriesForWebhook({
    webhookEndpointId: webhookId,
    organizationId: existing.organizationId,
    limit: 25,
    offset: 0,
  });

  return {
    webhook: repo.toPublicWebhook(existing),
    deliveries: items.map((d) => repo.toPublicDelivery(d)),
    deliveryTotal: total,
  };
}

export async function getPublicApiUsage(
  actorId: string,
  organizationId: string,
  query: { days?: number; limit?: number; offset?: number; apiKeyId?: string },
) {
  await assertDeveloperAdmin(actorId, organizationId);
  const days = query.days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const metrics = await getUsageMetrics(organizationId, since);
  const events = await listApiUsageEvents({
    organizationId,
    apiKeyId: query.apiKeyId,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  });
  return {
    metrics,
    requests: events.items.map(toPublicUsageEvent),
    total: events.total,
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  };
}

export async function getDeveloperAnalytics(
  actorId: string,
  organizationId: string,
  days: number,
) {
  await assertDeveloperAdmin(actorId, organizationId);
  const {
    getDeveloperAnalyticsOverview,
  } = await import("./developer.analytics.js");
  const { detectAnomalies } = await import("./developer.anomalies.js");
  const { loadAnalyticsEvents } = await import("./developer.analytics.js");
  const overview = await getDeveloperAnalyticsOverview(organizationId, days);
  const events = await loadAnalyticsEvents(organizationId, days);
  return {
    ...overview,
    anomalies: detectAnomalies(events),
  };
}

export async function getDeveloperAnalyticsUsage(
  actorId: string,
  organizationId: string,
  days: number,
) {
  await assertDeveloperAdmin(actorId, organizationId);
  const { getDeveloperUsageAnalytics } = await import("./developer.analytics.js");
  return getDeveloperUsageAnalytics(organizationId, days);
}

export async function getDeveloperAnalyticsErrors(
  actorId: string,
  organizationId: string,
  days: number,
) {
  await assertDeveloperAdmin(actorId, organizationId);
  const { getDeveloperErrorAnalytics } = await import("./developer.analytics.js");
  return getDeveloperErrorAnalytics(organizationId, days);
}

export async function getDeveloperAnalyticsLatency(
  actorId: string,
  organizationId: string,
  days: number,
) {
  await assertDeveloperAdmin(actorId, organizationId);
  const { getDeveloperLatencyAnalytics } = await import("./developer.analytics.js");
  return getDeveloperLatencyAnalytics(organizationId, days);
}

export async function listDeveloperQuotas(actorId: string, organizationId: string) {
  await assertDeveloperAdmin(actorId, organizationId);
  const {
    getOrCreateDeveloperQuota,
    refreshDeveloperQuotaUsage,
    toPublicDeveloperQuota,
  } = await import("./developer.quotas.js");
  await getOrCreateDeveloperQuota(organizationId);
  const row = await refreshDeveloperQuotaUsage(organizationId, actorId);
  return { quotas: [toPublicDeveloperQuota(row)] };
}

export async function patchDeveloperQuota(
  actorId: string,
  quotaId: string,
  body: {
    requestsPerDay?: number;
    requestsPerMonth?: number;
    maxApiKeys?: number;
    maxWebhooks?: number;
    maxServiceAccounts?: number;
  },
) {
  const { updateDeveloperQuotaLimits, toPublicDeveloperQuota } = await import(
    "./developer.quotas.js"
  );
  const { prisma } = await import("@trustchain/database");
  const existing = await prisma.developerApiQuota.findUnique({ where: { id: quotaId } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Developer quota not found");
  await assertDeveloperAdmin(actorId, existing.organizationId);
  const updated = await updateDeveloperQuotaLimits(quotaId, body, actorId);
  return { quota: toPublicDeveloperQuota(updated) };
}

export async function searchDeveloperAuditLogs(
  actorId: string,
  query: {
    organizationId: string;
    action?: string;
    actorUserId?: string;
    targetType?: string;
    success?: boolean;
    from?: string;
    to?: string;
    q?: string;
    limit: number;
    offset: number;
  },
) {
  await assertDeveloperAdmin(actorId, query.organizationId);
  const { searchDeveloperAudit } = await import("./developer.audit.js");
  return searchDeveloperAudit(query);
}
