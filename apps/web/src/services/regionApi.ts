import { apiClient } from "./http";

export type PlatformRegion = {
  id: string;
  code: string;
  name: string;
  jurisdiction: string;
  endpointUrl: string;
  status: string;
  priority: number;
  latencyWeight: number;
};

export type ResidencyReport = {
  organizationId: string;
  report: {
    homeRegionCode: string;
    mode: string;
    allowedRegions: string[];
    lockedClasses: string[];
    compliance: {
      homeActive: boolean;
      allowedCoverage: number;
      replicationAligned: boolean;
      failoverAligned: boolean;
    };
  };
  replication: {
    mode: string;
    targets: string[];
    health: { healthy: boolean; violations: Array<{ region: string; lagSeconds: number }> };
  };
  routing: { strategy: string; stickyTtlSeconds: number } | null;
  failover: {
    mode: string;
    primaryRegionCode: string;
    standbyRegions: string[];
  } | null;
  recentFailovers: Array<{
    id: string;
    fromRegionCode: string;
    toRegionCode: string;
    reason: string;
    status: string;
    createdAt: string;
  }>;
  regions: PlatformRegion[];
};

export const regionApi = {
  list(params?: { status?: string; organizationId?: string }) {
    return apiClient.get<{ regions: PlatformRegion[]; total: number }>("/regions", { params });
  },

  create(body: Record<string, unknown>) {
    return apiClient.post<{ region: PlatformRegion }>("/regions", body);
  },

  patch(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ region: PlatformRegion }>(`/regions/${id}`, body);
  },

  routing(params: {
    organizationId: string;
    clientRegionHint?: string;
    stickyRegion?: string;
    dataClass?: string;
  }) {
    return apiClient.get<{
      decision: { regionCode: string; reason: string };
      residency: { homeRegionCode: string; mode: string; allowedRegions: string[] };
      routing: { strategy: string };
    }>("/regions/routing", { params });
  },

  failover(body: Record<string, unknown>) {
    return apiClient.post<{
      failover: {
        id: string;
        fromRegionCode: string;
        toRegionCode: string;
        reason: string;
      } | null;
      selection: { action: string; toRegionCode?: string; reason: string };
      message?: string;
    }>("/regions/failover", body);
  },

  residency(organizationId: string) {
    return apiClient.get<ResidencyReport>("/regions/residency", {
      params: { organizationId },
    });
  },
};
