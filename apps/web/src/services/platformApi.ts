import { apiClient } from "./http";

export type PlatformHealthCheck = {
  name: string;
  status: string;
  latencyMs: number | null;
  detail?: string;
  required?: boolean;
};

export type PlatformHealthReport = {
  status: string;
  generatedAt: string;
  uptimeSeconds: number;
  checks: PlatformHealthCheck[];
  process: {
    nodeVersion: string;
    pid: number;
    memoryRssBytes: number;
  };
};

export type PlatformReadinessReport = {
  id: string;
  status: string;
  score: number;
  blockers: string[];
  healthStatus: string;
  checks: PlatformHealthCheck[];
  createdAt: string;
};

export type PlatformConfigEntry = {
  id: string | null;
  key: string;
  value: unknown;
  description: string | null;
  updatedAt: string | null;
  default?: boolean;
};

export type PlatformFeatureFlag = {
  id: string;
  publicCode: string;
  organizationId: string | null;
  key: string;
  status: string;
  rolloutPercent: number;
  killSwitch: boolean;
  targeting: unknown;
  experiments: unknown;
  createdAt: string;
  updatedAt: string;
};

export type PlatformMetrics = {
  generatedAt: string;
  healthStatus: string;
  readinessStatus: string;
  dependencyScore: number;
  featureFlags: { total: number; active: number; killSwitched: number };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    backend: string;
  };
  tracing: {
    windowKey: string;
    spanCount: number;
    errorCount: number;
    errorRate: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    services: Record<string, { count: number; errors: number; avgMs: number }>;
  };
  process: { uptimeSeconds: number; memoryRssBytes: number };
};

export const platformApi = {
  health() {
    return apiClient.get<PlatformHealthReport>("/platform/health");
  },

  readiness() {
    return apiClient.get<PlatformReadinessReport>("/platform/readiness");
  },

  configuration() {
    return apiClient.get<{ entries: PlatformConfigEntry[] }>("/platform/configuration");
  },

  patchConfiguration(body: {
    entries: Array<{ key: string; value: Record<string, unknown>; description?: string | null }>;
  }) {
    return apiClient.patch<{ entries: PlatformConfigEntry[] }>(
      "/platform/configuration",
      body,
    );
  },

  features(params?: { organizationId?: string; limit?: number }) {
    return apiClient.get<{
      features: PlatformFeatureFlag[];
      evaluations: Array<{
        key: string;
        bucket0: { enabled: boolean; reason: string };
        bucket50: { enabled: boolean; reason: string };
        bucket99: { enabled: boolean; reason: string };
      }>;
    }>("/platform/features", { params });
  },

  patchFeature(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ feature: PlatformFeatureFlag }>(
      `/platform/features/${id}`,
      body,
    );
  },

  metrics(params?: { persist?: boolean }) {
    return apiClient.get<{ metrics: PlatformMetrics; tracing: PlatformMetrics["tracing"] }>(
      "/platform/metrics",
      {
        params: params?.persist ? { persist: "true" } : undefined,
      },
    );
  },
};
