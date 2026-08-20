import { apiClient } from "./http";

export type RecoveryPolicy = {
  id: string;
  organizationId: string;
  name: string;
  frequency: string;
  rpoMinutes: number;
  rtoMinutes: number;
  retentionDays: number;
  regionCode: string;
  scopes: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RecoveryBackup = {
  id: string;
  status: string;
  regionCode: string;
  checksumSha256: string | null;
  sizeBytes: number;
  scopes: string[];
  completedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type RecoveryDashboard = {
  organizationId: string;
  policies: RecoveryPolicy[];
  recentBackups: RecoveryBackup[];
  recentRestores: Array<{
    id: string;
    status: string;
    backupJobId: string;
    targetRegionCode: string;
    completedAt: string | null;
    createdAt: string;
  }>;
  recentFailbacks: Array<{
    id: string;
    status: string;
    fromRegionCode: string;
    toRegionCode: string;
    reason: string;
    completedAt: string | null;
    createdAt: string;
  }>;
  objectives: {
    rpoMinutes: number;
    rtoMinutes: number;
    achievedRpoMinutes: number | null;
    rpoMet: boolean;
  } | null;
  latestScore: number | null;
};

export type RecoveryStatus = {
  organizationId: string;
  objectives: RecoveryDashboard["objectives"];
  continuity: {
    score: number;
    factors: Record<string, number>;
  };
  counts: {
    policies: number;
    backups: number;
    restores: number;
    failbacks: number;
  };
  latestBackup: RecoveryBackup | null;
};

export type ContinuityReport = {
  id: string;
  score: number;
  summary: unknown;
  createdAt: string;
};

export const recoveryApi = {
  dashboard(organizationId: string) {
    return apiClient.get<RecoveryDashboard>("/recovery", {
      params: { organizationId },
    });
  },

  createBackup(body: Record<string, unknown>) {
    return apiClient.post<{
      policy: RecoveryPolicy;
      backup: RecoveryBackup;
      scheduledDue: boolean;
    }>("/recovery/backups", body);
  },

  createRestore(body: {
    organizationId: string;
    backupJobId: string;
    targetRegionCode: string;
  }) {
    return apiClient.post<{
      restore: {
        id: string;
        status: string;
        backupJobId: string;
        targetRegionCode: string;
        achievedRtoMinutes: number;
        completedAt: string;
      };
    }>("/recovery/restores", body);
  },

  createFailback(body: {
    organizationId: string;
    fromRegionCode: string;
    toRegionCode: string;
    reason: string;
  }) {
    return apiClient.post<{
      failback: {
        id: string;
        status: string;
        fromRegionCode: string;
        toRegionCode: string;
        completed: boolean;
      };
    }>("/recovery/failback", body);
  },

  status(organizationId: string) {
    return apiClient.get<RecoveryStatus>("/recovery/status", {
      params: { organizationId },
    });
  },

  reports(organizationId: string, params?: { limit?: number; offset?: number }) {
    return apiClient.get<{
      reports: ContinuityReport[];
      latest: ContinuityReport;
      total: number;
      limit: number;
      offset: number;
    }>("/recovery/reports", {
      params: { organizationId, ...params },
    });
  },
};
