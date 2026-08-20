/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import {
  getDefaultSignaturePolicies,
  signatureKeys,
} from "./hooks";
import {
  approvalStatusTone,
  getSignatureErrorMessage,
  isInvalidSignaturePayload,
  isSignatureExpired,
  isSignatureForbidden,
  isSignatureNotFound,
  isSignatureRevoked,
  isUnsupportedAlgorithm,
  signatureEventTone,
  signatureStatusTone,
  signatureVerificationReasonLabel,
  workflowStatusTone,
} from "../../lib/signatureErrors";
import type {
  ApiErrorBody,
  CreateSignatureApprovalWorkflowInput,
  SignDetachedInput,
  SignatureCreateInput,
  SignaturePolicyView,
  SignatureSummary,
  SignatureVerificationResult,
} from "../../types/api";

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

describe("signature creation", () => {
  it("shapes create payload", () => {
    const body: SignatureCreateInput = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      documentId: "22222222-2222-2222-2222-222222222222",
      algorithm: "RSA-SHA256",
      metadata: { workflow: "document" },
    };
    expect(body.algorithm).toBe("RSA-SHA256");
    expect(body.documentId).toBeTruthy();
  });

  it("uses list and detail query keys after creation", () => {
    expect(signatureKeys("org-1").list({ status: "active" })).toEqual([
      "signatures",
      "org-1",
      "list",
      { status: "active" },
    ]);
    expect(signatureKeys("org-1", "sig-1").detail).toEqual(["signatures", "org-1", "sig-1"]);
  });

  it("maps unsupported algorithm on create", () => {
    const error = axiosError(400, "ALGORITHM_NOT_IMPLEMENTED", "Ed25519 reserved");
    expect(isUnsupportedAlgorithm(error)).toBe(true);
    expect(getSignatureErrorMessage(error)).toMatch(/algorithm/i);
  });
});

describe("signature verification", () => {
  it("labels verification reasons", () => {
    expect(signatureVerificationReasonLabel("SIGNATURE_REVOKED")).toMatch(/revoked/i);
    expect(signatureVerificationReasonLabel("SIGNATURE_EXPIRED")).toMatch(/expired/i);
    expect(signatureVerificationReasonLabel("CRYPTOGRAPHIC_VERIFICATION_FAILED")).toMatch(
      /cryptographic/i,
    );
  });

  it("evaluates verification contract shape", () => {
    const verification: SignatureVerificationResult = {
      valid: false,
      status: "revoked",
      checks: {
        algorithmSupported: true,
        cryptographic: true,
        integrity: true,
        notRevoked: false,
        notExpired: true,
      },
      reasons: ["SIGNATURE_REVOKED"],
    };
    expect(verification.valid).toBe(false);
    expect(verification.checks.notRevoked).toBe(false);
  });

  it("maps revoked and expired verification errors", () => {
    expect(isSignatureRevoked(axiosError(400, "SIGNATURE_REVOKED", "revoked"))).toBe(true);
    expect(isSignatureExpired(axiosError(400, "SIGNATURE_EXPIRED", "expired"))).toBe(true);
    expect(getSignatureErrorMessage(axiosError(400, "SIGNATURE_REVOKED", "x"))).toMatch(/revoked/i);
  });
});

describe("signature revocation", () => {
  it("tones revoked status", () => {
    expect(signatureStatusTone("revoked")).toBe("danger");
    expect(signatureStatusTone("active")).toBe("success");
    expect(signatureStatusTone("expired")).toBe("warning");
  });

  it("maps revoke policy denial", () => {
    const error = axiosError(403, "REVOKE_POLICY_DENIED", "not allowed");
    expect(isSignatureForbidden(error)).toBe(true);
    expect(getSignatureErrorMessage(error)).toMatch(/permission/i);
  });
});

describe("detached signatures", () => {
  it("shapes detached sign payload", () => {
    const body: SignDetachedInput = {
      organizationId: "11111111-1111-1111-1111-111111111111",
      payload: { statement: "Approved" },
      algorithm: "ECDSA-P256-SHA256",
    };
    expect(body.payload).toEqual({ statement: "Approved" });
    expect(body.algorithm).toBe("ECDSA-P256-SHA256");
  });

  it("maps invalid detached payload errors", () => {
    const error = axiosError(400, "INVALID_DETACHED_PAYLOAD", "empty");
    expect(isInvalidSignaturePayload(error)).toBe(true);
    expect(getSignatureErrorMessage(error)).toMatch(/invalid/i);
  });
});

describe("policy rendering", () => {
  it("exposes default policy view", () => {
    const policy: SignaturePolicyView = getDefaultSignaturePolicies();
    expect(policy.allowedAlgorithms).toContain("RSA-SHA256");
    expect(policy.allowDetached).toBe(true);
    expect(policy.allowDocumentSigning).toBe(true);
    expect(signatureKeys("org-1").policies).toEqual(["signatures", "org-1", "policies"]);
  });
});

describe("history rendering", () => {
  it("tones history events", () => {
    expect(signatureEventTone("created")).toBe("success");
    expect(signatureEventTone("verified")).toBe("info");
    expect(signatureEventTone("revoked")).toBe("danger");
    expect(signatureEventTone("expired")).toBe("warning");
  });

  it("shapes summary used by history selectors", () => {
    const summary: SignatureSummary = {
      id: "sig-1",
      publicId: "SIG-1",
      organizationId: "org-1",
      signerId: "user-1",
      documentId: null,
      certificateId: null,
      algorithm: "RSA-SHA256",
      status: "active",
      publicKeyPem: "pem",
      signatureValue: "sig",
      payloadHash: "a".repeat(64),
      integrityHash: "b".repeat(64),
      signedAt: "2026-08-03T12:00:00.000Z",
      expiresAt: null,
      metadata: { workflow: "detached" },
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      createdAt: "2026-08-03T12:00:00.000Z",
      updatedAt: "2026-08-03T12:00:00.000Z",
    };
    expect(summary.publicId).toMatch(/^SIG-/);
    expect(isSignatureNotFound(axiosError(404, "SIGNATURE_NOT_FOUND", "missing"))).toBe(true);
  });
});

describe("approval workflows", () => {
  it("shapes create workflow payload", () => {
    const body: CreateSignatureApprovalWorkflowInput = {
      organizationId: "org-1",
      title: "Dual control",
      workflowType: "sequential",
      reviewers: [
        { reviewerId: "r1", stepOrder: 1 },
        { reviewerId: "r2", stepOrder: 2 },
      ],
    };
    expect(body.workflowType).toBe("sequential");
    expect(body.reviewers).toHaveLength(2);
  });

  it("uses workflow query keys", () => {
    expect(signatureKeys("org-1").workflows({ status: "pending" })).toEqual([
      "signatures",
      "org-1",
      "workflows",
      { status: "pending" },
    ]);
    expect(signatureKeys("org-1").workflowDetail("wf-1")).toEqual([
      "signatures",
      "org-1",
      "workflows",
      "wf-1",
    ]);
  });

  it("tones workflow and approval statuses", () => {
    expect(workflowStatusTone("approved")).toBe("success");
    expect(workflowStatusTone("rejected")).toBe("danger");
    expect(approvalStatusTone("pending")).toBe("info");
    expect(approvalStatusTone("skipped")).toBe("warning");
  });
});
