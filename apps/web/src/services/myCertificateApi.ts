import { apiClient } from "./http";
import type { CertificateExportFormat, CertificateListResponse, CertificateSummary } from "../types/api";

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

export const myCertificateApi = {
  list(params?: { status?: string; limit?: number; offset?: number }) {
    return apiClient.get<CertificateListResponse>("/me/certificates", { params });
  },

  get(certificateId: string) {
    return apiClient.get<{ certificate: CertificateSummary }>(`/me/certificates/${certificateId}`);
  },

  async download(certificateId: string, format: CertificateExportFormat) {
    const response = await apiClient.get<ArrayBuffer>(`/me/certificates/${certificateId}/${format}`, {
      responseType: "arraybuffer",
    });
    const contentType =
      format === "pdf"
        ? "application/pdf"
        : format === "svg"
          ? "image/svg+xml"
          : "image/png";
    const warnings = warningList(response.headers["x-certificate-warnings"] as string | undefined);
    const fileName = contentDispositionFileName(
      response.headers["content-disposition"] as string | undefined,
      `${certificateId}.${format}`,
    );
    return {
      blob: new Blob([response.data], { type: contentType }),
      fileName,
      warnings,
    };
  },
};
