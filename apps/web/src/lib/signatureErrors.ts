import { parseApiError } from "./apiErrors";

export function isSignatureNotFound(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.status === 404 ||
    parsed.code === "SIGNATURE_NOT_FOUND" ||
    parsed.code === "DOC_NOT_FOUND" ||
    parsed.code === "CERTIFICATE_NOT_FOUND" ||
    parsed.code === "ORG_NOT_FOUND"
  );
}

export function isSignatureForbidden(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.status === 403 ||
    parsed.code === "FORBIDDEN" ||
    parsed.code === "REVOKE_POLICY_DENIED" ||
    parsed.code === "WORKFLOW_POLICY_DENIED"
  );
}

export function isSignatureRevoked(error: unknown): boolean {
  return parseApiError(error).code === "SIGNATURE_REVOKED";
}

export function isSignatureExpired(error: unknown): boolean {
  return parseApiError(error).code === "SIGNATURE_EXPIRED";
}

export function isUnsupportedAlgorithm(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "UNSUPPORTED_ALGORITHM" ||
    parsed.code === "ALGORITHM_NOT_IMPLEMENTED" ||
    parsed.code === "ALGORITHM_POLICY_DENIED"
  );
}

export function isInvalidSignaturePayload(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "INVALID_PAYLOAD" ||
    parsed.code === "INVALID_DETACHED_PAYLOAD" ||
    parsed.code === "VALIDATION_ERROR" ||
    parsed.code === "DOCUMENT_NOT_SIGNABLE" ||
    parsed.code === "CERTIFICATE_NOT_SIGNABLE" ||
    parsed.code === "DOCUMENT_MISSING_HASH" ||
    parsed.code === "INVALID_EXPIRATION" ||
    parsed.code === "EXPIRATION_REQUIRED" ||
    parsed.code === "EXPIRATION_TOO_FAR" ||
    parsed.code === "INVALID_PRIVATE_KEY" ||
    parsed.code === "INVALID_REVIEWER" ||
    parsed.code === "INVALID_THRESHOLD" ||
    parsed.code === "WORKFLOW_NOT_PENDING" ||
    parsed.code === "WORKFLOW_EXPIRED" ||
    parsed.code === "NOT_CURRENT_STEP" ||
    parsed.code === "NOT_ASSIGNED_REVIEWER"
  );
}

export function getSignatureErrorMessage(error: unknown): string {
  if (isSignatureForbidden(error)) {
    return "You do not have permission for this signature action.";
  }
  if (isSignatureRevoked(error)) {
    return "This signature has been revoked.";
  }
  if (isSignatureExpired(error)) {
    return "This signature has expired.";
  }
  if (isUnsupportedAlgorithm(error)) {
    const message = parseApiError(error).message;
    return message?.toLowerCase().includes("algorithm")
      ? message
      : message
        ? `Unsupported algorithm: ${message}`
        : "Unsupported or disallowed signature algorithm.";
  }
  if (isInvalidSignaturePayload(error)) {
    const message = parseApiError(error).message;
    return message?.toLowerCase().includes("invalid")
      ? message
      : message
        ? `Invalid payload: ${message}`
        : "Invalid signature payload.";
  }
  if (isSignatureNotFound(error)) {
    const code = parseApiError(error).code;
    if (code === "DOC_NOT_FOUND") return "Document not found.";
    if (code === "CERTIFICATE_NOT_FOUND") return "Certificate not found.";
    return "Signature not found.";
  }
  return parseApiError(error).message;
}

export function signatureStatusTone(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "active":
      return "success";
    case "pending":
      return "info";
    case "expired":
      return "warning";
    case "revoked":
      return "danger";
    default:
      return "neutral";
  }
}

export function signatureVerificationReasonLabel(reason: string): string {
  switch (reason) {
    case "UNSUPPORTED_ALGORITHM":
      return "Unsupported algorithm";
    case "PAYLOAD_HASH_MISMATCH":
      return "Payload hash mismatch";
    case "INTEGRITY_MISMATCH":
      return "Integrity hash mismatch";
    case "CRYPTOGRAPHIC_VERIFICATION_FAILED":
      return "Cryptographic verification failed";
    case "SIGNATURE_REVOKED":
      return "Signature revoked";
    case "SIGNATURE_EXPIRED":
      return "Signature expired";
    case "DOCUMENT_CONTENT_HASH_MISMATCH":
      return "Document content hash mismatch";
    default:
      return reason.replace(/_/g, " ").toLowerCase();
  }
}

export function signatureEventTone(
  eventType: string,
): "success" | "warning" | "danger" | "neutral" | "info" {
  const type = eventType.toLowerCase();
  if (type === "revoked" || type.includes("revoke")) return "danger";
  if (type === "verified" || type.includes("verify")) return "info";
  if (type === "created" || type.includes("creat")) return "success";
  if (type === "expired" || type.includes("expir")) return "warning";
  return "neutral";
}

export function workflowStatusTone(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "info";
    case "expired":
      return "warning";
    case "rejected":
    case "cancelled":
      return "danger";
    default:
      return "neutral";
  }
}

export function approvalStatusTone(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "approved":
      return "success";
    case "pending":
      return "info";
    case "skipped":
    case "expired":
      return "warning";
    case "rejected":
      return "danger";
    default:
      return "neutral";
  }
}

export function downloadTextArtifact(fileName: string, content: string, contentType: string) {
  const blob = new Blob([content], { type: contentType || "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
