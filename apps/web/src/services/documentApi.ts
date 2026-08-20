import { apiClient } from "./http";
import type {
  DocumentAccessPolicy,
  DocumentAuditEntry,
  DocumentCategory,
  DocumentConfirmResponse,
  DocumentDetail,
  DocumentDownloadUrlResponse,
  DocumentListResponse,
  DocumentPermission,
  DocumentShare,
  DocumentTag,
  DocumentUploadUrlResponse,
  DocumentVersionSummary,
} from "../types/api";

export type ListDocumentsParams = {
  q?: string;
  status?: string;
  categoryId?: string;
  tag?: string;
  expiresBefore?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
};

export type CreateDocumentInput = {
  title: string;
  description?: string;
  categoryId?: string | null;
  tagIds?: string[];
  expiresAt?: string | null;
};

export type UploadUrlInput = {
  mimeType: string;
  originalFileName: string;
  expectedSizeBytes?: number;
};

export type ConfirmVersionInput = {
  uploadSessionId: string;
  contentHash: string;
  mimeType: string;
  sizeBytes: number;
  originalFileName: string;
  activate?: boolean;
};

export type CreateShareInput = {
  sharedWithUserId?: string;
  sharedWithEmail?: string;
  permission: DocumentPermission;
  expiresAt?: string | null;
};

function orgBase(organizationId: string) {
  return `/organizations/${organizationId}`;
}

function orgDocs(organizationId: string) {
  return `${orgBase(organizationId)}/documents`;
}

export const documentApi = {
  list(organizationId: string, params?: ListDocumentsParams) {
    const query = {
      ...params,
      includeDeleted:
        params?.includeDeleted === undefined ? undefined : params.includeDeleted ? "true" : "false",
    };
    return apiClient.get<DocumentListResponse>(orgDocs(organizationId), { params: query });
  },
  get(organizationId: string, documentId: string) {
    return apiClient.get<{ document: DocumentDetail }>(`${orgDocs(organizationId)}/${documentId}`);
  },
  create(organizationId: string, body: CreateDocumentInput) {
    return apiClient.post<{ document: DocumentDetail }>(orgDocs(organizationId), body);
  },
  createUploadUrl(organizationId: string, documentId: string, body: UploadUrlInput) {
    return apiClient.post<DocumentUploadUrlResponse>(
      `${orgDocs(organizationId)}/${documentId}/upload-url`,
      body,
    );
  },
  confirmVersion(organizationId: string, documentId: string, body: ConfirmVersionInput) {
    return apiClient.post<DocumentConfirmResponse>(
      `${orgDocs(organizationId)}/${documentId}/versions/confirm`,
      body,
    );
  },
  listVersions(organizationId: string, documentId: string) {
    return apiClient.get<{ versions: DocumentVersionSummary[] }>(
      `${orgDocs(organizationId)}/${documentId}/versions`,
    );
  },
  archive(organizationId: string, documentId: string) {
    return apiClient.post<{ document: DocumentDetail }>(
      `${orgDocs(organizationId)}/${documentId}/archive`,
    );
  },
  restore(organizationId: string, documentId: string) {
    return apiClient.post<{ document: DocumentDetail }>(
      `${orgDocs(organizationId)}/${documentId}/restore`,
    );
  },
  listShares(organizationId: string, documentId: string) {
    return apiClient.get<{ shares: DocumentShare[] }>(
      `${orgDocs(organizationId)}/${documentId}/shares`,
    );
  },
  createShare(organizationId: string, documentId: string, body: CreateShareInput) {
    return apiClient.post<{ share: DocumentShare }>(
      `${orgDocs(organizationId)}/${documentId}/shares`,
      body,
    );
  },
  revokeShare(organizationId: string, documentId: string, shareId: string) {
    return apiClient.delete<{ share: DocumentShare }>(
      `${orgDocs(organizationId)}/${documentId}/shares/${shareId}`,
    );
  },
  listAudit(organizationId: string, documentId: string) {
    return apiClient.get<{ entries: DocumentAuditEntry[] }>(
      `${orgDocs(organizationId)}/${documentId}/audit`,
    );
  },
  downloadUrl(organizationId: string, documentId: string, versionId?: string) {
    const path = versionId
      ? `${orgDocs(organizationId)}/${documentId}/versions/${versionId}/download-url`
      : `${orgDocs(organizationId)}/${documentId}/download-url`;
    return apiClient.get<DocumentDownloadUrlResponse>(path);
  },
  downloadContent(organizationId: string, documentId: string, versionId?: string) {
    return apiClient.get<Blob>(`${orgDocs(organizationId)}/${documentId}/content`, {
      params: versionId ? { versionId } : undefined,
      responseType: "blob",
    });
  },
  update(organizationId: string, documentId: string, body: {
    title?: string;
    description?: string | null;
    categoryId?: string | null;
    tagIds?: string[];
    status?: "draft" | "active";
  }) {
    return apiClient.patch<{ document: DocumentDetail }>(
      `${orgDocs(organizationId)}/${documentId}`,
      body,
    );
  },
  updateExpiration(organizationId: string, documentId: string, expiresAt: string | null) {
    return apiClient.patch<{ document: DocumentDetail }>(
      `${orgDocs(organizationId)}/${documentId}/expiration`,
      { expiresAt },
    );
  },
  listAccessPolicies(organizationId: string, documentId: string) {
    return apiClient.get<{ policies: DocumentAccessPolicy[] }>(
      `${orgDocs(organizationId)}/${documentId}/access-policies`,
    );
  },
  putAccessPolicies(
    organizationId: string,
    documentId: string,
    policies: Array<{
      subjectType: "user" | "role" | "organization";
      subjectId: string;
      permission: DocumentPermission;
    }>,
  ) {
    return apiClient.put<{ policies: DocumentAccessPolicy[] }>(
      `${orgDocs(organizationId)}/${documentId}/access-policies`,
      { policies },
    );
  },
  listCategories(organizationId: string) {
    return apiClient.get<{ categories: DocumentCategory[] }>(
      `${orgBase(organizationId)}/document-categories`,
    );
  },
  createCategory(organizationId: string, body: { name: string; description?: string | null }) {
    return apiClient.post<{ category: DocumentCategory }>(
      `${orgBase(organizationId)}/document-categories`,
      body,
    );
  },
  listTags(organizationId: string) {
    return apiClient.get<{ tags: DocumentTag[] }>(`${orgBase(organizationId)}/document-tags`);
  },
  createTag(organizationId: string, body: { name: string }) {
    return apiClient.post<{ tag: DocumentTag }>(`${orgBase(organizationId)}/document-tags`, body);
  },
};
