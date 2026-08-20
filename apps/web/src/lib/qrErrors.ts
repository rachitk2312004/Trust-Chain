import { parseApiError } from "./apiErrors";

export function isQrNotFound(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 404 || parsed.code === "QR_NOT_FOUND" || parsed.code === "DOC_NOT_FOUND";
}

export function isQrForbidden(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 403 || parsed.code === "FORBIDDEN";
}

export function isQrRevoked(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.code === "QR_REVOKED" || parsed.code === "QR_DISABLED";
}

export function isQrExpired(error: unknown): boolean {
  return parseApiError(error).code === "QR_EXPIRED";
}

export function isInvalidQrPayload(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "VALIDATION_ERROR" ||
    parsed.code === "QR_NOT_FOUND" ||
    Boolean(parsed.message?.toLowerCase().includes("payload"))
  );
}

export function getQrErrorMessage(error: unknown): string {
  if (isQrForbidden(error)) return "You do not have permission for this QR action.";
  if (isQrRevoked(error)) return "This QR code has been revoked or disabled.";
  if (isQrExpired(error)) return "This QR code has expired.";
  if (isQrNotFound(error)) {
    const code = parseApiError(error).code;
    if (code === "DOC_NOT_FOUND") return "Document not found.";
    return "QR code not found.";
  }
  if (isInvalidQrPayload(error)) {
    return parseApiError(error).message || "Invalid QR payload.";
  }
  return parseApiError(error).message;
}

export function qrStatusTone(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "expired":
    case "rotated":
      return "warning";
    case "revoked":
    case "disabled":
      return "danger";
    default:
      return "neutral";
  }
}

/** Extract opaque scan token from a QR scan URL (`/api/public/qr/:token` or `/qr/:token`). */
export function extractQrScanToken(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const idx = parts.lastIndexOf("qr");
    const token = idx >= 0 ? parts[idx + 1] : undefined;
    if (token) return token;
  } catch {
    // not a URL
  }
  const match = trimmed.match(/\/qr\/([^/?#]+)/i);
  const fromMatch = match?.[1];
  if (fromMatch) return fromMatch;
  return trimmed;
}

export function scanUrlFromPayload(payload: Record<string, unknown> | null | undefined): string | null {
  if (!payload) return null;
  const url = payload.url;
  return typeof url === "string" ? url : null;
}
