import axios from "axios";
import { apiClient } from "./http";
import { getApiBaseUrl } from "../lib/apiBase";
import type {
  CreateQrInput,
  CreateQrTemplateInput,
  PublicVerificationReport,
  QrAnalyticsRow,
  QrCodeSummary,
  QrCreateResponse,
  QrEvent,
  QrRotateResponse,
  QrTemplate,
} from "../types/api";

const publicQrClient = axios.create({
  baseURL: `${getApiBaseUrl()}/api/public`,
  timeout: 30_000,
});

function org(organizationId: string) {
  return `/organizations/${organizationId}`;
}

export const qrApi = {
  list(organizationId: string) {
    return apiClient.get<{ qrs: QrCodeSummary[] }>(`${org(organizationId)}/qr`);
  },
  listForDocument(organizationId: string, documentId: string) {
    return apiClient.get<{ qrs: QrCodeSummary[] }>(
      `${org(organizationId)}/documents/${documentId}/qr`,
    );
  },
  get(organizationId: string, publicCode: string) {
    return apiClient.get<{ qr: QrCodeSummary }>(
      `${org(organizationId)}/qr/${encodeURIComponent(publicCode)}`,
    );
  },
  create(organizationId: string, documentId: string, body: CreateQrInput = {}) {
    return apiClient.post<QrCreateResponse>(
      `${org(organizationId)}/documents/${documentId}/qr`,
      body,
    );
  },
  revoke(organizationId: string, publicCode: string) {
    return apiClient.post<{ qr: QrCodeSummary }>(
      `${org(organizationId)}/qr/${encodeURIComponent(publicCode)}/revoke`,
    );
  },
  disable(organizationId: string, publicCode: string) {
    return apiClient.post<{ qr: QrCodeSummary }>(
      `${org(organizationId)}/qr/${encodeURIComponent(publicCode)}/disable`,
    );
  },
  /** Closest “update”: rotate QR with optional new template/format. */
  rotate(organizationId: string, publicCode: string, body: Partial<CreateQrInput> = {}) {
    return apiClient.post<QrRotateResponse>(
      `${org(organizationId)}/qr/${encodeURIComponent(publicCode)}/rotate`,
      body,
    );
  },
  download(
    organizationId: string,
    publicCode: string,
    format: "png" | "svg" | "base64" = "png",
  ) {
    return apiClient.get<ArrayBuffer | string>(
      `${org(organizationId)}/qr/${encodeURIComponent(publicCode)}/download`,
      {
        params: { format },
        responseType: format === "base64" ? "json" : "arraybuffer",
      },
    );
  },
  listTemplates(organizationId: string) {
    return apiClient.get<{ templates: QrTemplate[] }>(`${org(organizationId)}/qr/templates`);
  },
  createTemplate(organizationId: string, body: CreateQrTemplateInput) {
    return apiClient.post<{ template: QrTemplate }>(`${org(organizationId)}/qr/templates`, body);
  },
  updateTemplate(
    organizationId: string,
    templateCode: string,
    body: Partial<CreateQrTemplateInput>,
  ) {
    return apiClient.patch<{ template: QrTemplate }>(
      `${org(organizationId)}/qr/templates/${encodeURIComponent(templateCode)}`,
      body,
    );
  },
  analytics(organizationId: string, documentId?: string) {
    const path = documentId
      ? `${org(organizationId)}/documents/${documentId}/qr/analytics`
      : `${org(organizationId)}/qr/analytics`;
    return apiClient.get<{ analytics: QrAnalyticsRow[] }>(path);
  },
  events(organizationId: string, documentId?: string) {
    const path = documentId
      ? `${org(organizationId)}/documents/${documentId}/qr/events`
      : `${org(organizationId)}/qr/events`;
    return apiClient.get<{ events: QrEvent[] }>(path);
  },
  publicScan(token: string) {
    return publicQrClient.get<{
      report: PublicVerificationReport;
      qr: {
        publicCode: string;
        formatVersion: string;
        integrity: QrCodeSummary["integrity"];
      } | null;
    }>(`/qr/${encodeURIComponent(token)}`);
  },
};
