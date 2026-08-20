import { apiClient } from "./http";

export type SearchHit = {
  entityType: string;
  entityId: string;
  organizationId: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  createdAt: string;
  score: number;
  matchKind: string;
};

export const searchApi = {
  search(params: {
    q?: string;
    organizationId?: string;
    entityTypes?: string;
    status?: string;
    from?: string;
    to?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<{
      results: SearchHit[];
      total: number;
      limit: number;
      offset: number;
      query: Record<string, unknown>;
    }>("/search", { params });
  },

  suggestions(params: { q: string; organizationId?: string; limit?: number }) {
    return apiClient.get<{
      suggestions: Array<{
        text: string;
        entityType: string;
        entityId: string;
        score: number;
      }>;
    }>("/search/suggestions", { params });
  },

  reindex(body: { organizationId?: string; entityTypes?: string[] }) {
    return apiClient.post<{
      job: {
        id: string;
        status: string;
        indexedCount: number;
        entityTypes: string[];
        organizationId: string | null;
        finishedAt: string | null;
      };
    }>("/search/reindex", body);
  },

  status(organizationId?: string) {
    return apiClient.get<{
      organizationId: string | null;
      entityTypes: string[];
      totalEntries: number;
      byEntityType: Record<string, number>;
      lastIndexedAt: string | null;
      latestJob: {
        id: string;
        status: string;
        indexedCount: number;
        errorMessage: string | null;
        startedAt: string | null;
        finishedAt: string | null;
        createdAt: string;
      } | null;
    }>("/search/status", { params: { organizationId } });
  },
};
