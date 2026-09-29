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

/** Fields that must not affect the issued identity hash (derived / presentation-only). */
const EXCLUDED_METADATA_KEYS = new Set([
  "documentContentHash",
  "layout",
  "layoutPreset",
  "preview",
]);

/** Normalize timestamps to second precision for Postgres round-trips. */
export function normalizeIntegrityTimestamp(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return typeof value === "string" ? value : null;
  return new Date(Math.floor(date.getTime() / 1000) * 1000).toISOString();
}

function stableJsonValue(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stableJsonValue);
  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    out[key] = stableJsonValue(record[key]);
  }
  return out;
}

function integrityMetadata(value: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    if (EXCLUDED_METADATA_KEYS.has(key)) continue;
    out[key] = stableJsonValue(value[key]);
  }
  return out;
}

/** Canonical JSON for hashing (sorted keys, stable nested values). */
export function canonicalizeCertificatePayload(payload: CertificateIntegrityPayload): string {
  const ordered = {
    documentId: payload.documentId,
    expiresAt: normalizeIntegrityTimestamp(payload.expiresAt),
    issuedAt: normalizeIntegrityTimestamp(payload.issuedAt),
    metadata: integrityMetadata(payload.metadata ?? {}),
    organizationId: payload.organizationId,
    publicId: payload.publicId,
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    templateId: payload.templateId,
    title: payload.title,
  };
  return JSON.stringify(ordered);
}

export function hashCertificatePayload(payload: CertificateIntegrityPayload): string {
  const canonical = canonicalizeCertificatePayload(payload);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Pre-layout-exclusion / pre-timestamp-normalization hash (for certificates already issued).
 * Verify accepts either current or legacy digest so older rows stay valid.
 */
export function hashCertificatePayloadLegacy(payload: CertificateIntegrityPayload): string {
  const metadata: Record<string, unknown> = {};
  for (const key of Object.keys(payload.metadata ?? {}).sort()) {
    if (key === "documentContentHash") continue;
    metadata[key] = payload.metadata[key];
  }
  const ordered = {
    documentId: payload.documentId,
    expiresAt: payload.expiresAt,
    issuedAt: payload.issuedAt,
    metadata,
    organizationId: payload.organizationId,
    publicId: payload.publicId,
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    templateId: payload.templateId,
    title: payload.title,
  };
  return createHash("sha256").update(JSON.stringify(ordered), "utf8").digest("hex");
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
