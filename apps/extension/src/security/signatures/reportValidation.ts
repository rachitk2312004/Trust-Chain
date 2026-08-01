import type { PublicReportView } from "../../types/extension.types.js";

/**
 * Structural / expiry validation of Wave 5 signed reports.
 * Does NOT embed the server HMAC secret — HTTPS + opaque signature fields.
 */
export function validateSignedReport(report: PublicReportView): {
  ok: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  if (!report || typeof report !== "object") {
    return { ok: false, reasons: ["missing_report"] };
  }
  if (!report.verificationResult) reasons.push("missing_verification_result");
  if (!report.reportChecksum) reasons.push("missing_checksum");
  if (!report.reportSignature) reasons.push("missing_signature");
  if (!report.issuedAt) reasons.push("missing_issued_at");
  if (report.expiresAt) {
    const exp = new Date(report.expiresAt).getTime();
    if (Number.isFinite(exp) && exp <= Date.now()) reasons.push("report_expired");
  }
  return { ok: reasons.length === 0, reasons };
}

export function isWarningOutcome(result: string | undefined): boolean {
  return (
    result === "revoked" || result === "tampered" || result === "expired" || result === "invalid"
  );
}

export function trustBadge(result: string | undefined): string {
  switch (result) {
    case "valid":
      return "Trusted";
    case "revoked":
      return "Revoked";
    case "tampered":
      return "Tampered";
    case "expired":
      return "Expired";
    case "missing":
      return "Missing";
    case "invalid":
      return "Invalid";
    default:
      return "Unverified";
  }
}
