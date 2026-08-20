import { apiClient } from "./http";
import type {
  CertificateBulkJob,
  CertificateBulkPreview,
  CertificateBulkPreviewInput,
  CertificateBulkStartInput,
  CertificateExportFormat,
  CertificateHistoryResponse,
  CertificateListResponse,
  CertificateSummary,
  CertificateTemplate,
  CertificateVerifyResponse,
  CreateCertificateTemplateInput,
  IssueCertificateInput,
  UpdateCertificateTemplateInput,
} from "../types/api";

function contentDispositionFileName(header: string | undefined, fallback: string): string {
  if (!header) return fallback;
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match?.[1]?.trim() || fallback;
}

function warningList(header: string | undefined): string[] {
  if (!header?.trim()) return [];
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
}

export const certificateApi = {
  list(
    organizationId: string,
    params?: { status?: string; limit?: number; offset?: number },
  ) {
    return apiClient.get<CertificateListResponse>("/certificates", {
      params: { organizationId, ...params },
    });
  },

  get(organizationId: string, certificateId: string) {
    return apiClient.get<{ certificate: CertificateSummary }>(`/certificates/${certificateId}`, {
      params: { organizationId },
    });
  },

  issue(body: IssueCertificateInput) {
    return apiClient.post<{ certificate: CertificateSummary }>("/certificates", body);
  },

  revoke(certificateId: string, body: { organizationId: string; reason?: string }) {
    return apiClient.post<{ certificate: CertificateSummary }>(
      `/certificates/${certificateId}/revoke`,
      body,
    );
  },

  verify(certificateId: string, body: { organizationId?: string } = {}) {
    return apiClient.post<CertificateVerifyResponse>(
      `/certificates/${certificateId}/verify`,
      body,
    );
  },

  history(
    organizationId: string,
    certificateId: string,
    params?: { limit?: number; offset?: number },
  ) {
    return apiClient.get<CertificateHistoryResponse>(`/certificates/${certificateId}/history`, {
      params: { organizationId, ...params },
    });
  },

  listTemplates(organizationId: string, status?: string) {
    return apiClient.get<{ templates: CertificateTemplate[] }>("/certificates/templates", {
      params: { organizationId, ...(status ? { status } : {}) },
    });
  },

  getTemplate(organizationId: string, templateId: string) {
    return apiClient.get<{ template: CertificateTemplate }>(
      `/certificates/templates/${templateId}`,
      { params: { organizationId } },
    );
  },

  createTemplate(body: CreateCertificateTemplateInput) {
    return apiClient.post<{ template: CertificateTemplate }>("/certificates/templates", body);
  },

  updateTemplate(
    organizationId: string,
    templateId: string,
    body: UpdateCertificateTemplateInput,
  ) {
    return apiClient.patch<{ template: CertificateTemplate }>(
      `/certificates/templates/${templateId}`,
      body,
      { params: { organizationId } },
    );
  },

  async download(
    organizationId: string,
    certificateId: string,
    format: CertificateExportFormat,
    publicIdFallback = "certificate",
  ) {
    const response = await apiClient.get<ArrayBuffer>(
      `/certificates/${certificateId}/${format}`,
      {
        params: { organizationId },
        responseType: "arraybuffer",
      },
    );

    const contentType =
      format === "pdf"
        ? "application/pdf"
        : format === "svg"
          ? "image/svg+xml"
          : "image/png";
    const fileName = contentDispositionFileName(
      response.headers["content-disposition"] as string | undefined,
      `${publicIdFallback}.${format}`,
    );
    const warnings = warningList(response.headers["x-certificate-warnings"] as string | undefined);
    const blob = new Blob([response.data], { type: contentType });

    return { format, blob, fileName, warnings };
  },

  previewBulk(body: CertificateBulkPreviewInput) {
    return apiClient.post<{ preview: CertificateBulkPreview }>("/certificates/bulk/preview", body);
  },

  startBulk(body: CertificateBulkStartInput) {
    return apiClient.post<{ job: CertificateBulkJob; preview: CertificateBulkPreview }>(
      "/certificates/bulk",
      body,
    );
  },

  getBulkJob(organizationId: string, jobId: string) {
    return apiClient.get<{ job: CertificateBulkJob }>(`/certificates/bulk/${jobId}`, {
      params: { organizationId },
    });
  },

  cancelBulkJob(organizationId: string, jobId: string) {
    return apiClient.post<{ job: CertificateBulkJob }>(`/certificates/bulk/${jobId}/cancel`, {
      organizationId,
    });
  },

  analytics(organizationId: string) {
    return apiClient.get<{ analytics: import("../types/api").CertificateAnalyticsSnapshot }>(
      "/certificates/analytics",
      { params: { organizationId } },
    );
  },

  analyticsTemplates(organizationId: string) {
    return apiClient.get<{
      templates: import("../types/api").CertificateAnalyticsSnapshot["templates"];
      activeTemplateCount: number;
      unusedActiveTemplates: Array<{ id: string; code: string; name: string }>;
    }>("/certificates/analytics/templates", { params: { organizationId } });
  },

  analyticsIssuance(organizationId: string) {
    return apiClient.get<{
      issuance: import("../types/api").CertificateAnalyticsSnapshot["issuance"];
      revocation: import("../types/api").CertificateAnalyticsSnapshot["revocation"];
      expiration: import("../types/api").CertificateAnalyticsSnapshot["expiration"];
      bulk: import("../types/api").CertificateAnalyticsSnapshot["bulk"];
    }>("/certificates/analytics/issuance", { params: { organizationId } });
  },

  analyticsDownloads(organizationId: string) {
    return apiClient.get<{
      downloads: import("../types/api").CertificateAnalyticsSnapshot["downloads"];
      rendering: import("../types/api").CertificateAnalyticsSnapshot["rendering"];
      process: import("../types/api").CertificateAnalyticsSnapshot["process"];
    }>("/certificates/analytics/downloads", { params: { organizationId } });
  },

  analyticsVerifications(organizationId: string) {
    return apiClient.get<{
      verification: import("../types/api").CertificateAnalyticsSnapshot["verification"];
    }>("/certificates/analytics/verifications", { params: { organizationId } });
  },

  adminReprocess(
    organizationId: string,
    body?: {
      certificateIds?: string[];
      limit?: number;
      renderFormat?: "pdf" | "png" | "svg";
      skipRender?: boolean;
    },
  ) {
    return apiClient.post<import("../types/api").CertificateAdminReprocessResult>(
      "/certificates/admin/reprocess",
      { organizationId, ...body },
    );
  },

  adminCleanup(
    organizationId: string,
    body?: {
      eventDays?: number;
      bulkJobDays?: number;
      temporaryAssetEventDays?: number;
    },
  ) {
    return apiClient.post<import("../types/api").CertificateAdminCleanupResult>(
      "/certificates/admin/cleanup",
      { organizationId, ...body },
    );
  },
};
