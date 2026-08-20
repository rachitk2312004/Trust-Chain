import { apiClient } from "./http";

export type PlatformAuditEvent = {
  id: string;
  correlationId: string;
  requestId: string | null;
  source: string;
  action: string;
  actorUserId: string | null;
  actorIp: string | null;
  organizationId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  meta: unknown;
  integrityHash: string;
  previousHash: string | null;
  createdAt: string;
};

export const auditApi = {
  list(params: Record<string, string | number | boolean | undefined>) {
    return apiClient.get<{
      events: PlatformAuditEvent[];
      total: number;
      limit: number;
      offset: number;
    }>("/audit", { params });
  },

  get(id: string, organizationId?: string) {
    return apiClient.get<{
      event: PlatformAuditEvent;
      replay: { sequence: number; linked: boolean } | null;
    }>(`/audit/${id}`, { params: { organizationId } });
  },

  timeline(params: Record<string, string | number | undefined>) {
    return apiClient.get<{
      correlationId: string | null;
      requestId: string | null;
      resourceKey: string | null;
      events: PlatformAuditEvent[];
      buckets: Array<{
        day: string;
        count: number;
        success: number;
        failure: number;
      }>;
      chainValid: boolean;
      actors: string[];
      resources: Array<{ type: string; id: string }>;
      replay: Array<{
        sequence: number;
        linked: boolean;
        event: PlatformAuditEvent;
      }>;
    }>("/audit/timeline", { params });
  },

  export(body: Record<string, unknown>) {
    return apiClient.post<{
      export: {
        id: string;
        status: string;
        format: string;
        rowCount: number;
        contentType: string;
        content: string | null;
        finishedAt: string | null;
      };
    }>("/audit/export", body);
  },

  status(organizationId?: string) {
    return apiClient.get<{
      organizationId: string | null;
      totalEvents: number;
      successCount: number;
      failureCount: number;
      bySource: Record<string, number>;
      lastEventAt: string | null;
      latestExport: {
        id: string;
        status: string;
        format: string;
        rowCount: number;
        finishedAt: string | null;
        createdAt: string;
      } | null;
    }>("/audit/status", { params: { organizationId } });
  },
};
