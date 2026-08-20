import { createHash, randomBytes } from "node:crypto";
import { getPublicAppUrl } from "../../lib/appUrls.js";

export type CertificateIntegrityPayload = {
  publicId: string;
  organizationId: string;
  title: string;
  recipientName: string;
  recipientEmail: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  templateId: string | null;
  documentId: string | null;
  metadata: Record<string, unknown>;
};

/** Canonical JSON for hashing (sorted keys, stable). */
export function canonicalizeCertificatePayload(payload: CertificateIntegrityPayload): string {
  const ordered = {
    documentId: payload.documentId,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    metadata: sortKeys(payload.metadata),
    organizationId: payload.organizationId,
    publicId: payload.publicId,
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    templateId: payload.templateId,
    title: payload.title,
  };
  return JSON.stringify(ordered);
}

function sortKeys(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    out[key] = value[key];
  }
  return out;
}

export function hashCertificatePayload(payload: CertificateIntegrityPayload): string {
  const canonical = canonicalizeCertificatePayload(payload);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function generateCertificatePublicId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `CERT-${stamp}-${rand}`;
}

export function buildVerificationUrl(publicId: string): string {
  return `${getPublicAppUrl()}/certificates/verify/${publicId}`;
}

export type GeneratedCertificateFields = {
  publicId: string;
  integrityHash: string;
  verificationUrl: string;
};

/**
 * Generates public id, integrity hash, and verification URL for a new certificate.
 */
export function generateCertificateIdentity(input: {
  organizationId: string;
  title: string;
  recipientName: string;
  recipientEmail?: string | null;
  issuedAt?: Date | null;
  expiresAt?: Date | null;
  templateId?: string | null;
  documentId?: string | null;
  metadata?: Record<string, unknown>;
  /** Optional custom public id (must already be unique). */
  publicId?: string | null;
}): GeneratedCertificateFields {
  const publicId = input.publicId?.trim() || generateCertificatePublicId();
  const issuedAt = input.issuedAt ?? new Date();
  const integrityHash = hashCertificatePayload({
    publicId,
    organizationId: input.organizationId,
    title: input.title,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail ?? null,
    issuedAt: issuedAt.toISOString(),
    expiresAt: input.expiresAt?.toISOString() ?? null,
    templateId: input.templateId ?? null,
    documentId: input.documentId ?? null,
    metadata: input.metadata ?? {},
  });
  return {
    publicId,
    integrityHash,
    verificationUrl: buildVerificationUrl(publicId),
  };
}
