import { apiClient } from "./http";

export type EvidenceItem = {
  id: string;
  organizationId: string;
  publicCode: string;
  title: string;
  description: string | null;
  status: string;
  currentVersion: number;
  checksumSha256: string;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number;
  tags: string[];
  frameworks: string[];
  metadata: unknown;
  validation: unknown;
  createdAt: string;
  updatedAt: string;
};

export const evidenceApi = {
  list(params: {
    organizationId: string;
    q?: string;
    status?: string;
    framework?: string;
    tag?: string;
    limit?: number;
  }) {
    return apiClient.get<{
      evidence: EvidenceItem[];
      total: number;
      limit: number;
      offset: number;
    }>("/evidence", { params });
  },

  create(body: Record<string, unknown>) {
    return apiClient.post<{ evidence: EvidenceItem }>("/evidence", body);
  },

  get(id: string) {
    return apiClient.get<{
      evidence: EvidenceItem;
      versions: Array<{
        id: string;
        version: number;
        checksumSha256: string;
        fileName: string | null;
        sizeBytes: number;
        changeNote: string | null;
        createdAt: string;
      }>;
      links: Array<{
        id: string;
        targetType: string;
        targetId: string;
        label: string | null;
        createdAt: string;
      }>;
      custody: Array<{
        id: string;
        action: string;
        actorUserId: string | null;
        integrityHash: string;
        previousHash: string | null;
        createdAt: string;
      }>;
      chainValid: boolean;
    }>(`/evidence/${id}`);
  },

  patch(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ evidence: EvidenceItem }>(`/evidence/${id}`, body);
  },

  link(id: string, body: { targetType: string; targetId: string; label?: string }) {
    return apiClient.post<{ link: Record<string, unknown> }>(`/evidence/${id}/link`, body);
  },

  export(body: { organizationId: string; format?: "json" | "csv" }) {
    return apiClient.post<{
      export: {
        id: string;
        status: string;
        format: string;
        rowCount: number;
        content: string | null;
        contentType: string;
      };
    }>("/evidence/export", body);
  },
};
