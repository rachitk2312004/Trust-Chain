import { CertificateStatuses } from "@trustchain/config";
import {
  hashCertificatePayload,
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

export type CertificateVerifyResult = {
  valid: boolean;
  status: string;
  checks: {
    integrity: boolean;
    notRevoked: boolean;
    notExpired: boolean;
    documentOk: boolean;
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

/**
 * Foundation verifier — integrity hash + status/expiry (+ optional document state).
 * Does not perform advanced cryptographic signing.
 */
export function verifyCertificate(
  cert: CertificateVerifyInput,
  now = new Date(),
): CertificateVerifyResult {
  const payload = buildIntegrityPayloadFromCertificate(cert);
  const expectedHash = hashCertificatePayload(payload);
  const integrity = expectedHash === cert.integrityHash;
  const notRevoked = cert.status !== CertificateStatuses.revoked;
  const notExpired =
    cert.status !== CertificateStatuses.expired &&
    (!cert.expiresAt || cert.expiresAt.getTime() > now.getTime());
  const documentOk =
    !cert.documentId ||
    (!cert.documentDeletedAt &&
      cert.documentStatus !== "archived" &&
      cert.documentStatus !== "deleted");

  const reasons: string[] = [];
  if (!integrity) reasons.push("INTEGRITY_MISMATCH");
  if (!notRevoked) reasons.push("CERTIFICATE_REVOKED");
  if (!notExpired) reasons.push("CERTIFICATE_EXPIRED");
  if (!documentOk) reasons.push("LINKED_DOCUMENT_UNAVAILABLE");

  const valid = integrity && notRevoked && notExpired && documentOk;

  return {
    valid,
    status: cert.status,
    checks: { integrity, notRevoked, notExpired, documentOk },
    integrityHash: cert.integrityHash,
    expectedHash,
    reasons,
  };
}
