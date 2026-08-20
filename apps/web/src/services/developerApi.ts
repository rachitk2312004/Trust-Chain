import { apiClient } from "./http";
import type {
  DeveloperCreateKeyInput,
  DeveloperCreateServiceAccountInput,
  DeveloperCreateWebhookInput,
  DeveloperDashboardResponse,
  DeveloperApiKey,
  DeveloperPatchKeyInput,
  DeveloperPatchServiceAccountInput,
  DeveloperPatchWebhookInput,
  DeveloperSdkMetadata,
  DeveloperServiceAccount,
  DeveloperWebhook,
  DeveloperWebhookDelivery,
} from "../types/api";

export const developerApi = {
  dashboard(organizationId: string) {
    return apiClient.get<DeveloperDashboardResponse>("/developer/dashboard", {
      params: { organizationId },
    });
  },

  sdk(organizationId: string) {
    return apiClient.get<{ sdk: DeveloperSdkMetadata }>("/developer/sdk", {
      params: { organizationId },
    });
  },

  listKeys(params: {
    organizationId: string;
    status?: string;
    serviceAccountId?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      keys: DeveloperApiKey[];
      total: number;
      limit: number;
      offset: number;
    }>("/developer/keys", { params });
  },

  createKey(body: DeveloperCreateKeyInput) {
    return apiClient.post<{ key: DeveloperApiKey; secret: string }>("/developer/keys", body);
  },

  patchKey(keyId: string, body: DeveloperPatchKeyInput) {
    return apiClient.patch<{
      key: DeveloperApiKey;
      secret?: string;
      rotatedFromId?: string;
    }>(`/developer/keys/${keyId}`, body);
  },

  deleteKey(keyId: string) {
    return apiClient.delete<{ deleted: boolean; revoked: boolean; keyId: string }>(
      `/developer/keys/${keyId}`,
    );
  },

  listWebhooks(params: {
    organizationId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      webhooks: DeveloperWebhook[];
      total: number;
      limit: number;
      offset: number;
    }>("/developer/webhooks", { params });
  },

  createWebhook(body: DeveloperCreateWebhookInput) {
    return apiClient.post<{
      webhook: DeveloperWebhook;
      secret: string;
      delivery: DeveloperWebhookDelivery;
    }>("/developer/webhooks", body);
  },

  patchWebhook(id: string, body: DeveloperPatchWebhookInput) {
    return apiClient.patch<{
      webhook: DeveloperWebhook;
      secret?: string;
      deliveries: DeveloperWebhookDelivery[];
    }>(`/developer/webhooks/${id}`, body);
  },

  deleteWebhook(id: string) {
    return apiClient.delete<{ deleted: boolean; webhookId: string }>(
      `/developer/webhooks/${id}`,
    );
  },

  getWebhook(id: string) {
    return apiClient.get<{
      webhook: DeveloperWebhook;
      deliveries: DeveloperWebhookDelivery[];
      deliveryTotal: number;
    }>(`/developer/webhooks/${id}`);
  },

  listDeliveries(
    id: string,
    params?: { status?: string; limit?: number; offset?: number },
  ) {
    return apiClient.get<{
      deliveries: DeveloperWebhookDelivery[];
      total: number;
      limit: number;
      offset: number;
    }>(`/developer/webhooks/${id}/deliveries`, { params });
  },

  getDelivery(id: string, deliveryId: string) {
    return apiClient.get<{
      delivery: DeveloperWebhookDelivery & {
        payload?: unknown;
        responseBody?: string | null;
      };
      webhook: DeveloperWebhook;
    }>(`/developer/webhooks/${id}/deliveries/${deliveryId}`);
  },

  testWebhook(
    id: string,
    body?: { eventType?: string; data?: Record<string, unknown>; dispatch?: boolean },
  ) {
    return apiClient.post<{
      delivery: DeveloperWebhookDelivery & {
        payload?: unknown;
        responseBody?: string | null;
      };
      dispatch: {
        deliveryId: string;
        ok: boolean;
        status?: number;
        deadLettered?: boolean;
        error?: string;
      } | null;
    }>(`/developer/webhooks/${id}/test`, body ?? {});
  },

  replayWebhook(id: string, body: { deliveryId: string; dispatch?: boolean }) {
    return apiClient.post<{
      delivery: DeveloperWebhookDelivery & {
        payload?: unknown;
        responseBody?: string | null;
      };
      sourceDeliveryId: string;
      dispatch: {
        deliveryId: string;
        ok: boolean;
        status?: number;
        deadLettered?: boolean;
        error?: string;
      } | null;
    }>(`/developer/webhooks/${id}/replay`, body);
  },

  listServiceAccounts(params: {
    organizationId: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      serviceAccounts: DeveloperServiceAccount[];
      total: number;
      limit: number;
      offset: number;
    }>("/developer/service-accounts", { params });
  },

  createServiceAccount(body: DeveloperCreateServiceAccountInput) {
    return apiClient.post<{
      serviceAccount: DeveloperServiceAccount;
      secret: string;
    }>("/developer/service-accounts", body);
  },

  patchServiceAccount(serviceAccountId: string, body: DeveloperPatchServiceAccountInput) {
    return apiClient.patch<{
      serviceAccount: DeveloperServiceAccount;
      secret?: string;
    }>(`/developer/service-accounts/${serviceAccountId}`, body);
  },

  usage(params: {
    organizationId: string;
    days?: number;
    apiKeyId?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      metrics: {
        organizationId: string;
        windowStart: string | null;
        totals: {
          requests: number;
          success: number;
          clientError: number;
          serverError: number;
          avgDurationMs: number | null;
        };
        byMethod: Array<{ method: string; count: number }>;
      };
      requests: Array<{
        id: string;
        organizationId: string;
        apiKeyId: string | null;
        serviceAccountId: string | null;
        method: string;
        path: string;
        statusCode: number;
        scope: string | null;
        requestId: string | null;
        durationMs: number | null;
        createdAt: string;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>("/developer/usage", { params });
  },

  openapiJson(organizationId: string) {
    return apiClient.get<{
      openapi: string;
      info: Record<string, unknown>;
      paths: Record<string, unknown>;
      components: Record<string, unknown>;
    }>("/developer/openapi.json", { params: { organizationId } });
  },

  analytics(organizationId: string, days = 30) {
    return apiClient.get<{
      organizationId: string;
      days: number;
      generatedAt: string;
      totals: {
        requests: number;
        success: number;
        errors: number;
        errorRate: number;
        avgDurationMs: number | null;
        p95DurationMs: number | null;
      };
      usage: Array<{
        bucket: string;
        requests: number;
        success: number;
        clientError: number;
        serverError: number;
        avgDurationMs: number | null;
      }>;
      errors: {
        totalRequests: number;
        errors: number;
        errorRate: number;
        byStatus: Array<{ statusCode: number; count: number }>;
        byPath: Array<{ path: string; errors: number; total: number; errorRate: number }>;
      };
      latency: {
        samples: number;
        avgMs: number | null;
        p50Ms: number | null;
        p95Ms: number | null;
        p99Ms: number | null;
        maxMs: number | null;
        byPath: Array<{ path: string; samples: number; avgMs: number; p95Ms: number | null }>;
      };
      monitoring?: {
        status: string;
        requests: number;
        errorRate: number;
        avgLatencyMs: number | null;
        p95LatencyMs: number | null;
      };
      anomalies?: Array<{
        id: string;
        type: string;
        severity: "info" | "warn" | "critical";
        message: string;
        value: number;
        threshold: number;
      }>;
    }>("/developer/analytics", { params: { organizationId, days } });
  },

  analyticsUsage(organizationId: string, days = 30) {
    return apiClient.get<{
      organizationId: string;
      days: number;
      series: Array<{
        bucket: string;
        requests: number;
        success: number;
        clientError: number;
        serverError: number;
        avgDurationMs: number | null;
      }>;
      totals: Record<string, unknown>;
    }>("/developer/analytics/usage", { params: { organizationId, days } });
  },

  analyticsErrors(organizationId: string, days = 30) {
    return apiClient.get<{
      organizationId: string;
      days: number;
      totalRequests: number;
      errors: number;
      errorRate: number;
      byStatus: Array<{ statusCode: number; count: number }>;
      byPath: Array<{ path: string; errors: number; total: number; errorRate: number }>;
    }>("/developer/analytics/errors", { params: { organizationId, days } });
  },

  analyticsLatency(organizationId: string, days = 30) {
    return apiClient.get<{
      organizationId: string;
      days: number;
      samples: number;
      avgMs: number | null;
      p50Ms: number | null;
      p95Ms: number | null;
      p99Ms: number | null;
      byPath: Array<{ path: string; samples: number; avgMs: number; p95Ms: number | null }>;
    }>("/developer/analytics/latency", { params: { organizationId, days } });
  },

  quotas(organizationId: string) {
    return apiClient.get<{
      quotas: Array<{
        id: string;
        organizationId: string;
        limits: {
          requestsPerDay: number;
          requestsPerMonth: number;
          maxApiKeys: number;
          maxWebhooks: number;
          maxServiceAccounts: number;
        };
        usage: {
          requestsToday: number;
          requestsMonth: number;
          apiKeys: number;
          webhooks: number;
          serviceAccounts: number;
        };
        utilization: Array<{
          key: string;
          limit: number;
          used: number;
          ratio: number;
          exhausted: boolean;
        }>;
        exhausted: boolean;
        exhaustedAt: string | null;
      }>;
    }>("/developer/quotas", { params: { organizationId } });
  },

  patchQuota(
    id: string,
    body: Partial<{
      requestsPerDay: number;
      requestsPerMonth: number;
      maxApiKeys: number;
      maxWebhooks: number;
      maxServiceAccounts: number;
    }>,
  ) {
    return apiClient.patch<{ quota: Record<string, unknown> }>(`/developer/quotas/${id}`, body);
  },

  audit(params: {
    organizationId: string;
    action?: string;
    actorUserId?: string;
    targetType?: string;
    success?: boolean;
    from?: string;
    to?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      events: Array<{
        id: string;
        action: string;
        actorUserId: string | null;
        targetType: string | null;
        targetId: string | null;
        success: boolean;
        createdAt: string;
      }>;
      total: number;
      limit: number;
      offset: number;
    }>("/developer/audit", { params });
  },
};
