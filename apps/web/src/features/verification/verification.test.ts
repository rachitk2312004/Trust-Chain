/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import {
  confidenceFromReport,
  extractPublicLinkToken,
  getVerificationErrorMessage,
  isInactivePublicLink,
  isInvalidHash,
  isRevokedOutcome,
  isSha256Hex,
  isVerifyForbidden,
  isVerifyNotFound,
  outcomeTone,
} from "../../lib/verifyErrors";
import type { ApiErrorBody } from "../../types/api";
import { aggregateStats, verifyKeys } from "./hooks";

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

describe("hash verification", () => {
  it("accepts 64-char hex digests only", () => {
    expect(isSha256Hex("a".repeat(64))).toBe(true);
    expect(isSha256Hex("not-a-hash")).toBe(false);
    expect(isSha256Hex("a".repeat(63))).toBe(false);
  });

  it("maps invalid hash validation errors", () => {
    const error = axiosError(400, "VALIDATION_ERROR", "contentHash must be a SHA-256 hex digest");
    expect(isInvalidHash(error)).toBe(true);
    expect(getVerificationErrorMessage(error)).toMatch(/invalid hash/i);
  });
});

describe("upload verification", () => {
  it("uses upload verification flow keys for org refresh", () => {
    expect(verifyKeys("org-1").all).toEqual(["verifications", "org-1"]);
    expect(verifyKeys("org-1", "ver-1").detail).toEqual(["verifications", "org-1", "ver-1"]);
  });

  it("maps unsupported/not-found document during verify", () => {
    const error = axiosError(404, "VERIFY_NOT_FOUND", "Document not found");
    expect(isVerifyNotFound(error)).toBe(true);
    expect(getVerificationErrorMessage(error)).toMatch(/not found/i);
  });
});

describe("public verification", () => {
  it("extracts link tokens from QR-style URLs", () => {
    expect(extractPublicLinkToken("https://verify.example.com/link/abc123token")).toBe(
      "abc123token",
    );
    expect(extractPublicLinkToken("abc123token")).toBe("abc123token");
  });

  it("maps inactive/expired public links", () => {
    const error = axiosError(410, "PUBLIC_VERIFY_LINK_INACTIVE", "Link is expired");
    expect(isInactivePublicLink(error)).toBe(true);
    expect(getVerificationErrorMessage(error)).toMatch(/expired|revoked|no longer active/i);
  });

  it("maps public not found", () => {
    const error = axiosError(404, "PUBLIC_VERIFY_NOT_FOUND", "Verification not found");
    expect(isVerifyNotFound(error)).toBe(true);
  });
});

describe("history retrieval", () => {
  it("builds list query keys with filters", () => {
    expect(
      verifyKeys("org-1").list({ status: "completed", outcome: "valid", limit: 20, offset: 0 }),
    ).toEqual([
      "verifications",
      "org-1",
      "list",
      { status: "completed", outcome: "valid", limit: 20, offset: 0 },
    ]);
  });

  it("aggregates statistics from history rows", () => {
    const stats = aggregateStats([
      { outcome: "valid", request: { status: "completed" } },
      { outcome: "valid", request: { status: "completed" } },
      { outcome: "revoked", request: { status: "completed" } },
      { outcome: null, request: { status: "pending" } },
    ]);
    expect(stats.total).toBe(4);
    expect(stats.byOutcome.valid).toBe(2);
    expect(stats.byOutcome.revoked).toBe(1);
    expect(stats.byStatus.pending).toBe(1);
    expect(stats.validRate).toBe(50);
  });
});

describe("status transitions", () => {
  it("maps outcomes to status indicator tones", () => {
    expect(outcomeTone("valid")).toBe("success");
    expect(outcomeTone("revoked")).toBe("danger");
    expect(outcomeTone("expired")).toBe("warning");
    expect(outcomeTone("tampered")).toBe("danger");
  });

  it("computes confidence from check transitions", () => {
    const high = confidenceFromReport({
      verificationResult: "valid",
      checks: [
        { passed: true },
        { passed: true },
        { passed: true },
        { passed: true },
      ],
      failureReasons: [],
    });
    expect(high.tone).toBe("success");
    expect(high.score).toBe(100);

    const failed = confidenceFromReport({
      verificationResult: "tampered",
      checks: [{ passed: false }, { passed: true }],
      failureReasons: ["hash mismatch"],
    });
    expect(failed.tone).toBe("danger");
    expect(isRevokedOutcome("revoked")).toBe(true);
  });

  it("maps permission denied", () => {
    const error = axiosError(403, "VERIFY_FORBIDDEN", "Organization membership required");
    expect(isVerifyForbidden(error)).toBe(true);
    expect(getVerificationErrorMessage(error)).toMatch(/permission/i);
  });
});
