import { getApiBaseUrl } from "./apiBase";
import { ApiConstants } from "@trustchain/config";
import { documentApi } from "../services/documentApi";
import { tokenVault } from "./tokenVault";

function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadDocumentFile(
  organizationId: string,
  documentId: string,
  fileName: string,
  versionId?: string,
): Promise<void> {
  const { data } = await documentApi.downloadUrl(organizationId, documentId, versionId);

  if (data.downloadMode === "presigned") {
    const response = await fetch(data.downloadUrl);
    if (!response.ok) throw new Error("Download failed");
    const blob = await response.blob();
    triggerBlobDownload(blob, fileName);
    return;
  }

  // Encrypted objects stream through the API proxy with the bearer token.
  const base = `${getApiBaseUrl()}${ApiConstants.prefix}`;
  const path = data.proxyPath.startsWith("/api/")
    ? data.proxyPath.replace(/^\/api\/v1/, "")
    : data.proxyPath;
  const url = path.startsWith("http") ? path : `${base}${path.startsWith("/") ? "" : "/"}${path}`;
  const token = tokenVault.getAccessToken();
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  if (!response.ok) throw new Error("Download failed");
  const blob = await response.blob();
  triggerBlobDownload(blob, fileName);
}
