import { CertificateStatuses } from "@trustchain/config";
import { contentHashesEqual } from "../../lib/contentHash.js";
import {
  hashCertificatePayload,
  hashCertificatePayloadLegacy,
  type CertificateIntegrityPayload,
} from "./certificates.generator.js";

export type CertificateVerifyInput = {
  publicId: string;
  organizationId: string;
  title: string;
  recipientName: string;
  recipientEmail: string | null;
  issuedAt: Date | null;
  expiresAt: Date | null;
  templateId: string | null;
  documentId: string | null;
  metadata: Record<string, unknown>;
  integrityHash: string;
  status: string;
  qrPublicCode: string | null;
  documentStatus?: string | null;
  documentDeletedAt?: Date | null;
};

export type CertificateVerifyEvidence = {
  artifactPresent?: boolean;
  artifactHash?: string | null;
  expectedArtifactHash?: string | null;
  chainEnabled?: boolean;
  chainLive?: boolean;
  chainRevoked?: boolean;
  chainHash?: string | null;
};

export type CertificateVerifyResult = {
  valid: boolean;
  status: string;
  checks: {
    integrity: boolean;
    notRevoked: boolean;
    notExpired: boolean;
    documentOk: boolean;
    artifact: boolean;
    chain: boolean;
  };
  integrityHash: string;
  expectedHash: string;
  reasons: string[];
};

export function buildIntegrityPayloadFromCertificate(
  cert: CertificateVerifyInput,
): CertificateIntegrityPayload {
  return {
    publicId: cert.publicId,
    organizationId: cert.organizationId,
    title: cert.title,
    recipientName: cert.recipientName,
    recipientEmail: cert.recipientEmail,
    issuedAt: cert.issuedAt?.toISOString() ?? null,
    expiresAt: cert.expiresAt?.toISOString() ?? null,
    templateId: cert.templateId,
    documentId: cert.documentId,
    metadata: cert.metadata,
  };
}

function evaluateArtifact(
  cert: CertificateVerifyInput,
  evidence?: CertificateVerifyEvidence,
): { ok: boolean; reasons: string[] } {
  if (!cert.documentId || !evidence) {
    return { ok: true, reasons: [] };
  }
  if (!evidence.artifactPresent) {
    return { ok: false, reasons: ["ARTIFACT_MISSING"] };
  }
  if (!contentHashesEqual(evidence.artifactHash, evidence.expectedArtifactHash)) {
    return { ok: false, reasons: ["ARTIFACT_HASH_MISMATCH"] };
  }
  return { ok: true, reasons: [] };
}

function evaluateChain(
  _cert: CertificateVerifyInput,
  evidence?: CertificateVerifyEvidence,
): { ok: boolean; reasons: string[] } {
  if (!evidence || evidence.chainEnabled === false) {
    return { ok: true, reasons: [] };
  }
  if (evidence.chainRevoked) {
    return { ok: false, reasons: ["CHAIN_REVOKED"] };
  }
  if (!evidence.chainLive) {
    // Optional until anchored — does not invalidate; keep reasons clean for the UI.
    return { ok: true, reasons: [] };
  }
  const expected = evidence.expectedArtifactHash ?? evidence.artifactHash;
  if (expected && !contentHashesEqual(evidence.chainHash, expected)) {
    return { ok: false, reasons: ["CHAIN_HASH_MISMATCH"] };
  }
  return { ok: true, reasons: [] };
}

/**
 * Certificate trust checks: canonical metadata hash, lifecycle, stored PDF hash, and chain.
 * When evidence is omitted, artifact/chain checks pass so unit tests stay metadata-focused.
 */
export function verifyCertificate(
  cert: CertificateVerifyInput,
  evidence?: CertificateVerifyEvidence,
  now = new Date(),
): CertificateVerifyResult {
  const payload = buildIntegrityPayloadFromCertificate(cert);
  const expectedHash = hashCertificatePayload(payload);
  const legacyHash = hashCertificatePayloadLegacy({
    ...payload,
    issuedAt: cert.issuedAt?.toISOString() ?? null,
    expiresAt: cert.expiresAt?.toISOString() ?? null,
  });
  const integrity =
    expectedHash === cert.integrityHash || legacyHash === cert.integrityHash;
  const notRevoked = cert.status !== CertificateStatuses.revoked;
  const notExpired =
    cert.status !== CertificateStatuses.expired &&
    (!cert.expiresAt || cert.expiresAt.getTime() > now.getTime());
  const documentOk =
    !cert.documentId ||
    (!cert.documentDeletedAt &&
      cert.documentStatus !== "archived" &&
      cert.documentStatus !== "deleted");
  const artifact = evaluateArtifact(cert, evidence);
  const chain = evaluateChain(cert, evidence);

  const reasons: string[] = [];
  if (!integrity) reasons.push("INTEGRITY_MISMATCH");
  if (!notRevoked) reasons.push("CERTIFICATE_REVOKED");
  if (!notExpired) reasons.push("CERTIFICATE_EXPIRED");
  if (!documentOk) reasons.push("LINKED_DOCUMENT_UNAVAILABLE");
  reasons.push(...artifact.reasons, ...chain.reasons);

  const valid =
    integrity && notRevoked && notExpired && documentOk && artifact.ok && chain.ok;

  return {
    valid,
    status: cert.status,
    checks: {
      integrity,
      notRevoked,
      notExpired,
      documentOk,
      artifact: artifact.ok,
      chain: chain.ok,
    },
    integrityHash: cert.integrityHash,
    expectedHash,
    reasons,
  };
}
