import { parseApiError } from "./apiErrors";

export function isInvalidHash(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "VALIDATION_ERROR" ||
    Boolean(parsed.message?.toLowerCase().includes("hash"))
  );
}

export function isVerifyNotFound(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.status === 404 ||
    parsed.code === "VERIFY_NOT_FOUND" ||
    parsed.code === "PUBLIC_VERIFY_NOT_FOUND" ||
    parsed.code === "DOC_NOT_FOUND"
  );
}

export function isVerifyForbidden(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.status === 403 ||
    parsed.code === "VERIFY_FORBIDDEN" ||
    parsed.code === "FORBIDDEN"
  );
}

export function isRevokedOutcome(outcome: string | null | undefined): boolean {
  return outcome === "revoked";
}

export function isExpiredOutcome(outcome: string | null | undefined): boolean {
  return outcome === "expired";
}

export function isInactivePublicLink(error: unknown): boolean {
  const parsed = parseApiError(error);
  return parsed.code === "PUBLIC_VERIFY_LINK_INACTIVE" || parsed.status === 410;
}

export function isInvalidQrPayload(error: unknown): boolean {
  const parsed = parseApiError(error);
  return (
    parsed.code === "PUBLIC_VERIFY_LINK_INACTIVE" ||
    parsed.code === "PUBLIC_VERIFY_NOT_FOUND" ||
    parsed.code === "VALIDATION_ERROR"
  );
}

export function getVerificationErrorMessage(error: unknown): string {
  if (isInactivePublicLink(error)) {
    return "This verification link is expired, revoked, or no longer active.";
  }
  if (isVerifyForbidden(error)) {
    return "You do not have permission to run or view this verification.";
  }
  if (isVerifyNotFound(error)) {
    return "Document or verification not found.";
  }
  const parsed = parseApiError(error);
  if (parsed.code === "VERIFY_RATE_LIMITED" || parsed.code === "PUBLIC_VERIFY_RATE_LIMITED") {
    return "Too many verification attempts. Try again later.";
  }
  if (parsed.code === "PUBLIC_VERIFY_BLOCKED") {
    return "Temporarily blocked due to abuse protection.";
  }
  if (parsed.code === "VERIFY_IN_PROGRESS") {
    return "A verification is already in progress for this document.";
  }
  if (isInvalidHash(error) && parsed.message.toLowerCase().includes("hash")) {
    return "Invalid hash. Provide a 64-character SHA-256 hex digest.";
  }
  return parsed.message;
}

export function isSha256Hex(value: string): boolean {
  return /^[a-fA-F0-9]{64}$/.test(value.trim());
}

export function confidenceFromReport(report: {
  checks?: Array<{ passed: boolean }>;
  verificationResult?: string;
  failureReasons?: string[];
} | null): { label: string; score: number; tone: "success" | "warning" | "danger" | "neutral" } {
  if (!report) return { label: "Unknown", score: 0, tone: "neutral" };
  const checks = report.checks ?? [];
  const passed = checks.filter((c) => c.passed).length;
  const score = checks.length ? Math.round((passed / checks.length) * 100) : report.verificationResult === "valid" ? 100 : 0;
  if (report.verificationResult === "valid" && score >= 80) {
    return { label: "High confidence", score, tone: "success" };
  }
  if (report.verificationResult === "valid") {
    return { label: "Moderate confidence", score, tone: "warning" };
  }
  if (report.verificationResult === "revoked" || report.verificationResult === "tampered") {
    return { label: "Failed integrity", score, tone: "danger" };
  }
  if (report.verificationResult === "expired") {
    return { label: "Expired", score, tone: "warning" };
  }
  return { label: "Not valid", score, tone: "danger" };
}

export function outcomeTone(
  outcome: string | null | undefined,
): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (outcome) {
    case "valid":
      return "success";
    case "expired":
    case "missing":
      return "warning";
    case "invalid":
    case "revoked":
    case "tampered":
      return "danger";
    default:
      return "neutral";
  }
}

/** Extract a public link token from a pasted URL or raw token. */
export function extractPublicLinkToken(input: string): string {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const linkIdx = parts.indexOf("link");
    const tokenFromPath = linkIdx >= 0 ? parts[linkIdx + 1] : undefined;
    if (tokenFromPath) return tokenFromPath;
  } catch {
    // not a URL
  }
  const match = trimmed.match(/\/link\/([^/?#]+)/i);
  const tokenFromMatch = match?.[1];
  if (tokenFromMatch) return tokenFromMatch;
  return trimmed;
}
