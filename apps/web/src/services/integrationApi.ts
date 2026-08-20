import { apiClient } from "./http";

export type ConnectorCatalogItem = {
  key: string;
  name: string;
  category: string;
  authMode: string;
  description: string;
  defaultScopes: string[];
  eventTypes: string[];
};

export type EcosystemIntegration = {
  id: string;
  organizationId: string;
  connectorKey: string;
  connectorName: string;
  category: string;
  name: string;
  status: string;
  authMode: string;
  syncIntervalMinutes: number;
  syncMode: string;
  scopes: string[];
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  credential: {
    id: string;
    kind: string;
    version: number;
    secretLast4: string;
    rotatedAt: string | null;
  } | null;
  subscriptions: Array<{ id: string; eventType: string; enabled: boolean }>;
};

export type IntegrationDashboard = {
  organizationId: string;
  catalog: ConnectorCatalogItem[];
  integrations: EcosystemIntegration[];
  dashboard: {
    total: number;
    connected: number;
    errored: number;
    recentSuccessRate: number;
  };
  recentSyncJobs: Array<{
    id: string;
    integrationId: string;
    status: string;
    mode: string;
    completedAt: string | null;
    createdAt: string;
  }>;
};

export const integrationApi = {
  list(organizationId: string, params?: { status?: string; category?: string }) {
    return apiClient.get<IntegrationDashboard>("/integrations", {
      params: { organizationId, ...params },
    });
  },

  create(body: Record<string, unknown>) {
    return apiClient.post<{
      integration: EcosystemIntegration;
      issuedApiKey: string | null;
    }>("/integrations", body);
  },

  patch(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{
      integration: EcosystemIntegration;
      rotation: { version: number; secretLast4: string; issuedSecret?: string } | null;
    }>(`/integrations/${id}`, body);
  },

  oauth(body: Record<string, unknown>) {
    return apiClient.post<{
      action: string;
      authorizeUrl?: string;
      state?: string;
      expiresAt?: string;
      integration?: EcosystemIntegration;
      expiresIn?: number;
    }>("/integrations/oauth", body);
  },

  sync(body: { organizationId: string; integrationId?: string; force?: boolean; mode?: string }) {
    return apiClient.post<{
      jobs: Array<{
        id: string;
        integrationId: string;
        status: string;
        result: {
          recordsProcessed: number;
          eventsEmitted: string[];
        };
      }>;
      skipped: number;
    }>("/integrations/sync", body);
  },

  events(organizationId: string, params?: { integrationId?: string; limit?: number }) {
    return apiClient.get<{
      events: Array<{
        id: string;
        integrationId: string;
        eventType: string;
        payload: unknown;
        createdAt: string;
      }>;
      subscriptions: Array<{
        id: string;
        integrationId: string;
        eventType: string;
        enabled: boolean;
      }>;
      total: number;
    }>("/integrations/events", {
      params: { organizationId, ...params },
    });
  },
};
