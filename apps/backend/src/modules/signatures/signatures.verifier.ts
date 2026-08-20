import { SignatureStatuses } from "@trustchain/config";
import {
  assertSupportedAlgorithm,
  buildCanonicalPayload,
  canonicalizeSignaturePayload,
  hashCanonicalPayload,
  hashSignatureIntegrity,
  verifyCanonicalPayload,
  type CanonicalSignaturePayload,
} from "./signatures.validator.js";

export type SignatureVerifyInput = {
  publicId: string;
  organizationId: string;
  signerId: string;
  documentId: string | null;
  certificateId: string | null;
  algorithm: string;
  publicKeyPem: string;
  signatureValue: string;
  payloadHash: string;
  integrityHash: string;
  signedAt: Date;
  expiresAt: Date | null;
  metadata: Record<string, unknown>;
  status: string;
  contentHash?: string | null;
};

export type SignatureVerifyResult = {
  valid: boolean;
  status: string;
  checks: {
    algorithmSupported: boolean;
    cryptographic: boolean;
    integrity: boolean;
    notRevoked: boolean;
    notExpired: boolean;
  };
  reasons: string[];
  payloadHash: string;
  expectedPayloadHash: string;
  integrityHash: string;
  expectedIntegrityHash: string;
};

export function resolveEffectiveStatus(status: string, expiresAt: Date | null, now = new Date()): string {
  if (status === SignatureStatuses.revoked) return SignatureStatuses.revoked;
  if (status === SignatureStatuses.expired) return SignatureStatuses.expired;
  if (expiresAt && expiresAt.getTime() <= now.getTime()) return SignatureStatuses.expired;
  return status;
}

/**
 * Verifies cryptographic signature, record integrity, and lifecycle status.
 */
export function verifySignatureRecord(
  input: SignatureVerifyInput,
  now = new Date(),
): SignatureVerifyResult {
  const reasons: string[] = [];
  let algorithmSupported = true;
  let algorithmId: ReturnType<typeof assertSupportedAlgorithm> | null = null;
  try {
    algorithmId = assertSupportedAlgorithm(input.algorithm);
  } catch {
    algorithmSupported = false;
    reasons.push("UNSUPPORTED_ALGORITHM");
  }

  const payload: CanonicalSignaturePayload = buildCanonicalPayload({
    organizationId: input.organizationId,
    signerId: input.signerId,
    documentId: input.documentId,
    certificateId: input.certificateId,
    timestamp: input.signedAt,
    algorithm: input.algorithm,
    metadata: input.metadata,
    contentHash: input.contentHash ?? null,
  });
  const canonical = canonicalizeSignaturePayload(payload);
  const expectedPayloadHash = hashCanonicalPayload(canonical);
  const integrityOk = expectedPayloadHash === input.payloadHash;

  const expectedIntegrityHash = hashSignatureIntegrity({
    publicId: input.publicId,
    organizationId: input.organizationId,
    signerId: input.signerId,
    documentId: input.documentId,
    certificateId: input.certificateId,
    algorithm: input.algorithm,
    publicKeyPem: input.publicKeyPem,
    signatureValue: input.signatureValue,
    payloadHash: input.payloadHash,
    signedAt: input.signedAt.toISOString(),
    expiresAt: input.expiresAt?.toISOString() ?? null,
    metadata: input.metadata,
  });
  const recordIntegrityOk = expectedIntegrityHash === input.integrityHash;

  let cryptographic = false;
  if (algorithmId) {
    cryptographic = verifyCanonicalPayload(
      algorithmId,
      canonical,
      input.publicKeyPem,
      input.signatureValue,
    );
  }

  const status = resolveEffectiveStatus(input.status, input.expiresAt, now);
  const notRevoked = status !== SignatureStatuses.revoked;
  const notExpired = status !== SignatureStatuses.expired;

  if (!integrityOk) reasons.push("PAYLOAD_HASH_MISMATCH");
  if (!recordIntegrityOk) reasons.push("INTEGRITY_MISMATCH");
  if (algorithmSupported && !cryptographic) reasons.push("CRYPTOGRAPHIC_VERIFICATION_FAILED");
  if (!notRevoked) reasons.push("SIGNATURE_REVOKED");
  if (!notExpired) reasons.push("SIGNATURE_EXPIRED");

  const valid =
    algorithmSupported &&
    cryptographic &&
    integrityOk &&
    recordIntegrityOk &&
    notRevoked &&
    notExpired;

  return {
    valid,
    status,
    checks: {
      algorithmSupported,
      cryptographic,
      integrity: integrityOk && recordIntegrityOk,
      notRevoked,
      notExpired,
    },
    reasons,
    payloadHash: input.payloadHash,
    expectedPayloadHash,
    integrityHash: input.integrityHash,
    expectedIntegrityHash,
  };
}
