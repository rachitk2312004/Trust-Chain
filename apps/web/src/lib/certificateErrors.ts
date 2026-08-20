import { parseApiError } from "./apiErrors";

export function isCertificateNotFound(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.status === 404 ||
    parsed.code === "CERTIFICATE_NOT_FOUND" ||
    parsed.code === "TEMPLATE_NOT_FOUND" ||
    parsed.code === "ORG_NOT_FOUND"
  );
}

export function isCertificateForbidden(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.status === 403 || parsed.code === "FORBIDDEN";
}

export function isCertificateRevoked(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.code === "CERTIFICATE_REVOKED";
}

export function isCertificateExpired(error: unknown): boolean {
  return parseApiError(error).code === "CERTIFICATE_EXPIRED";
}

export function isInvalidCertificateTemplate(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "TEMPLATE_NOT_FOUND" ||
    parsed.code === "INVALID_TEMPLATE" ||
    (parsed.code === "VALIDATION_ERROR" &&
      Boolean(parsed.message?.toLowerCase().includes("template")))
  );
}

export function isCertificateRenderFailure(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "RENDER_FAILED" ||
    parsed.code === "UNSUPPORTED_FORMAT" ||
    parsed.code === "ASSET_MISSING" ||
    Boolean(parsed.message?.toLowerCase().includes("render"))
  );
}

export function isBulkValidationFailure(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "BULK_VALIDATION_FAILED" ||
    parsed.code === "BULK_NO_VALID_ROWS" ||
    parsed.code === "EMPTY_IMPORT" ||
    parsed.code === "INVALID_CSV_HEADER" ||
    parsed.code === "INVALID_JSON"
  );
}

export function isMissingCertificateAsset(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.code === "ASSET_MISSING" || parsed.code === "MISSING_ASSETS";
}

export function getCertificateErrorMessage(error: unknown): string {
  if (isCertificateForbidden(error)) {
    return "You do not have permission for this certificate action.";
  }
  if (isCertificateRevoked(error)) {
    return "This certificate has been revoked.";
  }
  if (isCertificateExpired(error)) {
    return "This certificate has expired.";
  }
  if (isInvalidCertificateTemplate(error)) {
    return parseApiError(error).message || "Invalid or missing certificate template.";
  }
  if (isMissingCertificateAsset(error)) {
    return "One or more certificate assets are missing.";
  }
  if (isBulkValidationFailure(error)) {
    return parseApiError(error).message || "Bulk import validation failed.";
  }
  if (isCertificateRenderFailure(error)) {
    return parseApiError(error).message?.toLowerCase().includes("render")
      ? parseApiError(error).message
      : "Certificate rendering failed.";
  }
  if (isCertificateNotFound(error)) {
    const code = parseApiError(error).code;
    if (code === "TEMPLATE_NOT_FOUND") return "Certificate template not found.";
    return "Certificate not found.";
  }
  return parseApiError(error).message;
}

export function certificateStatusTone(
  status: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "issued":
      return "success";
    case "expired":
    case "draft":
      return "warning";
    case "revoked":
      return "danger";
    default:
      return "neutral";
  }
}

export function verificationReasonLabel(reason: string): string {
  switch (reason) {
    case "INTEGRITY_MISMATCH":
      return "Integrity hash mismatch";
    case "CERTIFICATE_REVOKED":
      return "Certificate revoked";
    case "CERTIFICATE_EXPIRED":
      return "Certificate expired";
    case "DOCUMENT_INVALID":
      return "Linked document invalid";
    default:
      return reason.replace(/_/g, " ").toLowerCase();
  }
}

export function defaultCertificateLayoutPreview(): Record<string, unknown> {
  return {
    version: 1,
    orientation: "portrait",
    pageSize: "A4",
    backgroundColor: "#FFFDF8",
    textColor: "#1C1917",
    accentColor: "#B45309",
    borderColor: "#D6D3D1",
    titleTemplate: "Certificate of Achievement",
    subtitleTemplate: "{{organization_name}}",
    bodyTemplate:
      "This certifies that {{recipient_name}} has been awarded this certificate ({{certificate_id}}).",
    footerTemplate: "Verify at {{verification_url}}",
    showQr: true,
    showLogo: true,
    showSignature: true,
    signatureLabel: "Authorized signature",
  };
}
