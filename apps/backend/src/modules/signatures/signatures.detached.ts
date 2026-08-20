import { createHash } from "node:crypto";
import { SignatureArtifactKinds, SignatureStatuses } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import {
  assertSupportedAlgorithm,
  buildCanonicalPayload,
  canonicalizeSignaturePayload,
  hashCanonicalPayload,
  verifyCanonicalPayload,
  type CanonicalSignaturePayload,
} from "./signatures.validator.js";
import { verifySignatureRecord, type SignatureVerifyResult } from "./signatures.verifier.js";

export type DetachedPayloadInput =
  | string
  | Record<string, unknown>
  | { content: string; contentType?: string };

export function normalizeDetachedPayload(input: DetachedPayloadInput): {
  content: string;
  contentType: string;
  contentHash: string;
} {
  let content: string;
  let contentType = "text/plain";

  if (typeof input === "string") {
    content = input;
  } else if (input && typeof input === "object" && "content" in input && typeof input.content === "string") {
    content = input.content;
    if (typeof input.contentType === "string" && input.contentType.length > 0) {
      contentType = input.contentType;
    }
  } else if (input && typeof input === "object") {
    content = JSON.stringify(input);
    contentType = "application/json";
  } else {
    throw new AppError(400, "INVALID_DETACHED_PAYLOAD", "Detached payload is required");
  }

  if (!content || content.length === 0) {
    throw new AppError(400, "INVALID_DETACHED_PAYLOAD", "Detached payload must not be empty");
  }
  if (content.length > 512_000) {
    throw new AppError(400, "INVALID_DETACHED_PAYLOAD", "Detached payload exceeds 512KB limit");
  }

  const contentHash = createHash("sha256").update(content, "utf8").digest("hex");
  return { content, contentType, contentHash };
}

export function buildDetachedCanonical(input: {
  organizationId: string;
  signerId: string;
  timestamp: Date;
  algorithm: string;
  metadata?: Record<string, unknown>;
  contentHash: string;
}): { payload: CanonicalSignaturePayload; canonical: string; payloadHash: string } {
  const payload = buildCanonicalPayload({
    organizationId: input.organizationId,
    signerId: input.signerId,
    documentId: null,
    certificateId: null,
    timestamp: input.timestamp,
    algorithm: input.algorithm,
    metadata: { ...(input.metadata ?? {}), workflow: "detached" },
    contentHash: input.contentHash,
  });
  const canonical = canonicalizeSignaturePayload(payload);
  return { payload, canonical, payloadHash: hashCanonicalPayload(canonical) };
}

export type DetachedVerifyInput = {
  organizationId: string;
  signerId: string;
  algorithm: string;
  publicKeyPem: string;
  signatureValue: string;
  signedAt: Date | string;
  expiresAt?: Date | string | null;
  metadata?: Record<string, unknown>;
  /** Detached payload content (hashed for contentHash). */
  payload: DetachedPayloadInput;
  /** Optional: if verifying against a stored record. */
  publicId?: string;
  payloadHash?: string;
  integrityHash?: string;
  status?: string;
};

/**
 * Stateless detached verification (no DB). When payloadHash/integrityHash/publicId
 * are omitted, only cryptographic verification of the reconstructed canonical is checked.
 */
export function verifyDetachedSignature(input: DetachedVerifyInput): SignatureVerifyResult & {
  contentHash: string;
  detached: true;
} {
  const normalized = normalizeDetachedPayload(input.payload);
  let algorithmId;
  try {
    algorithmId = assertSupportedAlgorithm(input.algorithm);
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, "UNSUPPORTED_ALGORITHM", `Unsupported algorithm: ${input.algorithm}`);
  }

  const signedAt =
    input.signedAt instanceof Date ? input.signedAt : new Date(input.signedAt);
  if (Number.isNaN(signedAt.getTime())) {
    throw new AppError(400, "INVALID_PAYLOAD", "Invalid signedAt timestamp");
  }

  const expiresAt =
    input.expiresAt == null
      ? null
      : input.expiresAt instanceof Date
        ? input.expiresAt
        : new Date(input.expiresAt);
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError(400, "INVALID_EXPIRATION", "Invalid expiration date");
  }

  const metadata = { ...(input.metadata ?? {}), workflow: "detached" };
  const { canonical, payloadHash } = buildDetachedCanonical({
    organizationId: input.organizationId,
    signerId: input.signerId,
    timestamp: signedAt,
    algorithm: input.algorithm,
    metadata,
    contentHash: normalized.contentHash,
  });

  const cryptographic = verifyCanonicalPayload(
    algorithmId,
    canonical,
    input.publicKeyPem,
    input.signatureValue,
  );

  if (input.publicId && input.payloadHash && input.integrityHash) {
    const full = verifySignatureRecord({
      publicId: input.publicId,
      organizationId: input.organizationId,
      signerId: input.signerId,
      documentId: null,
      certificateId: null,
      algorithm: input.algorithm,
      publicKeyPem: input.publicKeyPem,
      signatureValue: input.signatureValue,
      payloadHash: input.payloadHash,
      integrityHash: input.integrityHash,
      signedAt,
      expiresAt,
      metadata,
      status: input.status ?? SignatureStatuses.active,
      contentHash: normalized.contentHash,
    });
    return { ...full, contentHash: normalized.contentHash, detached: true };
  }

  const reasons: string[] = [];
  if (!cryptographic) reasons.push("CRYPTOGRAPHIC_VERIFICATION_FAILED");
  if (expiresAt && expiresAt.getTime() <= Date.now()) reasons.push("SIGNATURE_EXPIRED");
  if (input.status === SignatureStatuses.revoked) reasons.push("SIGNATURE_REVOKED");

  const notExpired = !(expiresAt && expiresAt.getTime() <= Date.now());
  const notRevoked = input.status !== SignatureStatuses.revoked;

  return {
    valid: cryptographic && notExpired && notRevoked,
    status: !notRevoked
      ? SignatureStatuses.revoked
      : !notExpired
        ? SignatureStatuses.expired
        : (input.status ?? SignatureStatuses.active),
    checks: {
      algorithmSupported: true,
      cryptographic,
      integrity: true,
      notRevoked,
      notExpired,
    },
    reasons,
    payloadHash,
    expectedPayloadHash: payloadHash,
    integrityHash: input.integrityHash ?? "",
    expectedIntegrityHash: input.integrityHash ?? "",
    contentHash: normalized.contentHash,
    detached: true,
  };
}

export function pickDetachedArtifacts(
  artifacts: Array<{ kind: string; content: string; contentType: string }>,
) {
  return {
    payload: artifacts.find((a) => a.kind === SignatureArtifactKinds.detachedPayload) ?? null,
    signature: artifacts.find((a) => a.kind === SignatureArtifactKinds.detachedSignature) ?? null,
    publicKey: artifacts.find((a) => a.kind === SignatureArtifactKinds.publicKey) ?? null,
    canonical: artifacts.find((a) => a.kind === SignatureArtifactKinds.canonicalPayload) ?? null,
  };
}
