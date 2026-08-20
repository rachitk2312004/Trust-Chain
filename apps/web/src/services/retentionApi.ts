import { apiClient } from "./http";

export type RetentionPolicy = {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  targetType: string;
  retentionDays: number;
  disposition: string;
  status: string;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

export type LegalHold = {
  id: string;
  organizationId: string;
  name: string;
  reason: string;
  status: string;
  scope: string;
  targetType: string | null;
  targetIds: string[];
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
};

export type RetentionStatus = {
  organizationId: string;
  activePolicies: number;
  activeHolds: number;
  archives: { archived: number; purged: number; holdBlocked: number };
  chainValid: boolean;
  latestRun: {
    id: string;
    status: string;
    dryRun: boolean;
    summary: unknown;
    createdAt: string;
    finishedAt: string | null;
  } | null;
};

export const retentionApi = {
  listPolicies(params: { organizationId: string; targetType?: string; status?: string }) {
    return apiClient.get<{ policies: RetentionPolicy[]; total: number }>("/retention/policies", {
      params,
    });
  },

  createPolicy(body: Record<string, unknown>) {
    return apiClient.post<{ policy: RetentionPolicy }>("/retention/policies", body);
  },

  patchPolicy(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ policy: RetentionPolicy }>(`/retention/policies/${id}`, body);
  },

  listHolds(params: { organizationId: string; status?: string }) {
    return apiClient.get<{ holds: LegalHold[]; total: number }>("/retention/holds", { params });
  },

  createHold(body: Record<string, unknown>) {
    return apiClient.post<{ hold: LegalHold }>("/retention/holds", body);
  },

  patchHold(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ hold: LegalHold }>(`/retention/holds/${id}`, body);
  },

  run(body: { organizationId: string; dryRun?: boolean; targetType?: string }) {
    return apiClient.post<{
      run: {
        id: string;
        status: string;
        dryRun: boolean;
        summary: {
          archived: number;
          purged: number;
          holdBlocked: number;
          skipped: number;
          chainValid: boolean;
        };
      };
    }>("/retention/run", body);
  },

  status(organizationId: string) {
    return apiClient.get<RetentionStatus>("/retention/status", {
      params: { organizationId },
    });
  },
};
