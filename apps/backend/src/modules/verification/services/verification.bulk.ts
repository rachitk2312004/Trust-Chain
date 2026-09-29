import {
  CertificateStatuses,
  RoleKeys,
  VerificationOutcomes,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { userHasRole } from "../../auth/rbac.repository.js";
import { consumeOrgMetric } from "../../billing/billing.entitlements.js";
import { BillingFeatureKeys, BillingMetricKeys } from "../../billing/billing.plans.js";
import { verifyCertificateById } from "../../certificates/certificates.service.js";
import { saveCheckRun } from "./verification.checks.js";
import { identityMismatchMessage, namesMatch } from "./verification.names.js";
import { startDocumentVerification } from "./verification.service.js";

export const BULK_VERIFY_LIMIT = 20;
export const BULK_LIST_LIMIT = 50;
export const CERTIFICATE_PUBLIC_ID_RE = /CERT-[A-Z0-9]+-[0-9A-F]+/i;
export const SHA256_RE = /\b[a-fA-F0-9]{64}\b/;

export type BulkVerifyCategory = "documents" | "certificates" | "hashes" | "identifiers";

export type BulkVerifyItemResult = {
  label: string;
  category: BulkVerifyCategory;
  outcome: string;
  valid: boolean;
  requestId?: string;
  certificateId?: string;
  documentId?: string;
  publicId?: string;
  title?: string;
  recipientName?: string;
  uniqueId?: string;
  contentHash?: string;
  claimedName?: string;
  error?: string;
};

export function parseBulkLines(raw: string, limit = BULK_LIST_LIMIT): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function normalizeBulkIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const cert = trimmed.match(CERTIFICATE_PUBLIC_ID_RE);
  if (cert?.[0]) return cert[0].toUpperCase();
  const hash = trimmed.match(SHA256_RE);
  if (hash?.[0]) return hash[0].toLowerCase();
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return decodeURIComponent(last);
  } catch {
    // not a URL
  }
  return trimmed;
}

export function summarizeBulkResults(results: BulkVerifyItemResult[]) {
  const byOutcome: Record<string, number> = {};
  let valid = 0;
  let failed = 0;
  for (const row of results) {
    byOutcome[row.outcome] = (byOutcome[row.outcome] ?? 0) + 1;
    if (row.valid) valid += 1;
    else failed += 1;
  }
  return { total: results.length, valid, failed, byOutcome };
}

function asAppError(error: unknown): { message: string; outcome: string } {
  if (error instanceof AppError) {
    if (error.code === "VERIFY_NOT_FOUND" || error.code === "CERTIFICATE_NOT_FOUND") {
      return { message: error.message, outcome: VerificationOutcomes.missing };
    }
    if (error.code === "VERIFY_RATE_LIMITED") {
      return { message: error.message, outcome: "rate_limited" };
    }
    return { message: error.message, outcome: VerificationOutcomes.invalid };
  }
  return {
    message: error instanceof Error ? error.message : "Verification failed",
    outcome: VerificationOutcomes.invalid,
  };
}

function certificateOutcome(reasons: string[], valid: boolean): string {
  if (valid) return VerificationOutcomes.valid;
  if (reasons.includes("CERTIFICATE_REVOKED")) return VerificationOutcomes.revoked;
  if (reasons.includes("CERTIFICATE_EXPIRED")) return VerificationOutcomes.expired;
  if (
    reasons.includes("INTEGRITY_MISMATCH") ||
    reasons.includes("ARTIFACT_HASH_MISMATCH") ||
    reasons.includes("CHAIN_HASH_MISMATCH")
  ) {
    return VerificationOutcomes.tampered;
  }
  return VerificationOutcomes.invalid;
}

async function resolveDocumentIds(
  organizationId: string,
  input: { documentIds?: string[]; categoryId?: string | null; allActive?: boolean },
): Promise<Array<{ id: string; title: string }>> {
  if (input.documentIds?.length) {
    return prisma.document.findMany({
      where: { organizationId, id: { in: input.documentIds }, deletedAt: null },
      select: { id: true, title: true },
      take: BULK_VERIFY_LIMIT,
    });
  }
  return prisma.document.findMany({
    where: {
      organizationId,
      deletedAt: null,
      status: "active",
      ...(input.categoryId ? { categoryId: input.categoryId } : {}),
    },
    select: { id: true, title: true },
    orderBy: { updatedAt: "desc" },
    take: BULK_VERIFY_LIMIT,
  });
}

async function resolveCertificates(
  organizationId: string,
  certificateIds?: string[],
): Promise<Array<{ id: string; publicId: string; title: string; recipientName: string }>> {
  if (certificateIds?.length) {
    return prisma.certificate.findMany({
      where: { organizationId, id: { in: certificateIds } },
      select: { id: true, publicId: true, title: true, recipientName: true },
      take: BULK_VERIFY_LIMIT,
    });
  }
  return prisma.certificate.findMany({
    where: { organizationId, status: CertificateStatuses.issued },
    select: { id: true, publicId: true, title: true, recipientName: true },
    orderBy: { issuedAt: "desc" },
    take: BULK_VERIFY_LIMIT,
  });
}

async function verifyOneDocument(
  userId: string,
  organizationId: string,
  document: { id: string; title: string },
  expectedContentHash?: string,
): Promise<BulkVerifyItemResult> {
  try {
    const result = await startDocumentVerification(userId, organizationId, document.id, {
      mode: "sync",
      rehashFromR2: true,
      requireAnchor: true,
      requireLiveChain: true,
      expectedContentHash,
    });
    const outcome = result.report?.verificationResult ?? result.request.status;
    return {
      label: document.title,
      category: "documents",
      outcome,
      valid: outcome === VerificationOutcomes.valid,
      requestId: result.request.id,
      documentId: document.id,
      title: document.title,
      uniqueId: result.request.verificationCode,
      contentHash: result.report?.contentHash ?? expectedContentHash,
    };
  } catch (error) {
    const parsed = asAppError(error);
    return {
      label: document.title,
      category: "documents",
      outcome: parsed.outcome,
      valid: false,
      documentId: document.id,
      title: document.title,
      contentHash: expectedContentHash,
      error: parsed.message,
    };
  }
}

async function verifyOneCertificate(
  userId: string,
  organizationId: string,
  certificate: { id: string; publicId: string; title: string; recipientName?: string },
): Promise<BulkVerifyItemResult> {
  try {
    const result = await verifyCertificateById(userId, organizationId, certificate.id);
    const outcome = certificateOutcome(result.verification.reasons, result.verification.valid);
    return {
      label: `${certificate.title} (${certificate.publicId})`,
      category: "certificates",
      outcome,
      valid: result.verification.valid,
      certificateId: certificate.id,
      publicId: certificate.publicId,
      title: certificate.title,
      recipientName: certificate.recipientName,
      uniqueId: certificate.publicId,
    };
  } catch (error) {
    const parsed = asAppError(error);
    return {
      label: `${certificate.title} (${certificate.publicId})`,
      category: "certificates",
      outcome: parsed.outcome,
      valid: false,
      certificateId: certificate.id,
      publicId: certificate.publicId,
      title: certificate.title,
      recipientName: certificate.recipientName,
      uniqueId: certificate.publicId,
      error: parsed.message,
    };
  }
}

async function verifyOneHash(
  userId: string,
  organizationId: string,
  hash: string,
): Promise<BulkVerifyItemResult> {
  const contentHash = hash.toLowerCase().replace(/^0x/, "");
  const version = await prisma.documentVersion.findFirst({
    where: { contentHash, document: { organizationId, deletedAt: null } },
    include: { document: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  if (!version) {
    return {
      label: contentHash,
      category: "hashes",
      outcome: VerificationOutcomes.missing,
      valid: false,
      uniqueId: contentHash,
      contentHash,
      error: "No organization document matches this hash",
    };
  }
  const result = await verifyOneDocument(
    userId,
    organizationId,
    version.document,
    contentHash,
  );
  return {
    ...result,
    category: "hashes",
    label: `${version.document.title} · ${contentHash.slice(0, 12)}…`,
    uniqueId: contentHash,
    contentHash,
  };
}

async function verifyOneIdentifier(
  userId: string,
  organizationId: string,
  value: string,
  claimedName?: string,
): Promise<BulkVerifyItemResult> {
  const trimmed = normalizeBulkIdentifier(value);
  if (/^CERT-/i.test(trimmed)) {
    const cert = await prisma.certificate.findFirst({
      where: { organizationId, publicId: { equals: trimmed, mode: "insensitive" } },
      select: { id: true, publicId: true, title: true, recipientName: true },
    });
    if (!cert) {
      return {
        label: trimmed,
        category: "identifiers",
        outcome: VerificationOutcomes.missing,
        valid: false,
        uniqueId: trimmed,
        publicId: trimmed,
        claimedName: claimedName || undefined,
        error: "Not issued. No TrustChain certificate matches this CERT ID.",
      };
    }
    const result = await verifyOneCertificate(userId, organizationId, cert);
    if (claimedName && !namesMatch(claimedName, cert.recipientName)) {
      return {
        ...result,
        category: "identifiers",
        valid: false,
        outcome: VerificationOutcomes.invalid,
        claimedName,
        recipientName: cert.recipientName,
        label: `${claimedName} · ${cert.publicId}`,
        error: identityMismatchMessage(cert.recipientName, claimedName),
      };
    }
    return {
      ...result,
      category: "identifiers",
      claimedName: claimedName || undefined,
      label: claimedName ? `${claimedName} · ${cert.publicId}` : result.label,
    };
  }

  const request = await prisma.verificationRequest.findFirst({
    where: { organizationId, verificationCode: trimmed },
    include: { document: { select: { id: true, title: true } }, result: true },
  });
  if (request) {
    if (request.result) {
      const outcome = request.result.outcome;
      return {
        label: `${request.document.title} · ${trimmed}`,
        category: "identifiers",
        outcome,
        valid: outcome === VerificationOutcomes.valid,
        requestId: request.id,
        documentId: request.documentId,
        title: request.document.title,
        uniqueId: trimmed,
      };
    }
    const result = await verifyOneDocument(userId, organizationId, request.document);
    return {
      ...result,
      category: "identifiers",
      label: `${request.document.title} · ${trimmed}`,
      uniqueId: trimmed,
    };
  }

  const document = await prisma.document.findFirst({
    where: { organizationId, publicVerifyCode: trimmed, deletedAt: null },
    select: { id: true, title: true },
  });
  if (document) {
    const result = await verifyOneDocument(userId, organizationId, document);
    return {
      ...result,
      category: "identifiers",
      label: `${document.title} · ${trimmed}`,
      uniqueId: trimmed,
    };
  }

  if (/^[a-fA-F0-9]{64}$/.test(trimmed)) {
    const result = await verifyOneHash(userId, organizationId, trimmed);
    return { ...result, category: "identifiers" };
  }

  return {
    label: trimmed || value.trim(),
    category: "identifiers",
    outcome: VerificationOutcomes.missing,
    valid: false,
    uniqueId: trimmed || value.trim(),
    error: "Not issued. No matching certificate for this value.",
  };
}

export async function runBulkVerification(
  userId: string,
  organizationId: string,
  input: {
    category: BulkVerifyCategory;
    documentIds?: string[];
    categoryId?: string | null;
    certificateIds?: string[];
    hashes?: string[];
    identifiers?: string[];
    claims?: Array<{ identifier: string; name?: string }>;
  },
) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization staff role required");
  const claimedCount = Math.max(
    1,
    input.claims?.length ??
      input.identifiers?.length ??
      input.certificateIds?.length ??
      input.hashes?.length ??
      input.documentIds?.length ??
      0,
  );
  await consumeOrgMetric(
    userId,
    organizationId,
    BillingMetricKeys.orgVerifications,
    claimedCount,
    BillingFeatureKeys.orgVerification,
  );

  const results: BulkVerifyItemResult[] = [];

  if (input.category === "documents") {
    const documents = await resolveDocumentIds(organizationId, input);
    if (!documents.length) {
      throw new AppError(400, "BULK_EMPTY", "No documents found to verify");
    }
    for (const document of documents) {
      results.push(await verifyOneDocument(userId, organizationId, document));
    }
  } else if (input.category === "certificates") {
    const certificates = await resolveCertificates(organizationId, input.certificateIds);
    if (!certificates.length) {
      throw new AppError(400, "BULK_EMPTY", "No certificates found to verify");
    }
    for (const certificate of certificates) {
      results.push(await verifyOneCertificate(userId, organizationId, certificate));
    }
  } else if (input.category === "hashes") {
    const hashes = (input.hashes ?? [])
      .map((h) => normalizeBulkIdentifier(h))
      .filter(Boolean)
      .slice(0, BULK_LIST_LIMIT);
    if (!hashes.length) throw new AppError(400, "BULK_EMPTY", "Add at least one SHA-256 hash");
    for (const hash of hashes) {
      results.push(await verifyOneHash(userId, organizationId, hash));
    }
  } else {
    const source: Array<{ identifier: string; name?: string }> = input.claims?.length
      ? input.claims
      : (input.identifiers ?? []).map((identifier) => ({ identifier }));
    const claims = source
      .map((row) => ({
        identifier: row.identifier.trim(),
        name: row.name?.trim() || undefined,
      }))
      .filter((row) => row.identifier)
      .slice(0, BULK_LIST_LIMIT);
    if (!claims.length) {
      throw new AppError(400, "BULK_EMPTY", "Add at least one CERT ID");
    }
    for (const claim of claims) {
      results.push(await verifyOneIdentifier(userId, organizationId, claim.identifier, claim.name));
    }
  }

  await saveCheckRun(
    userId,
    organizationId,
    input.category,
    results.map((row) => ({
      inputLabel: row.label,
      outcome: row.outcome,
      valid: row.valid,
      recipientName: row.recipientName,
      publicId: row.publicId,
      title: row.title,
      uniqueId: row.uniqueId ?? row.publicId ?? row.contentHash,
      contentHash: row.contentHash,
      certificateId: row.certificateId,
      documentId: row.documentId,
      requestId: row.requestId,
      detail: row.error,
    })),
  );

  return {
    category: input.category,
    summary: summarizeBulkResults(results),
    results,
  };
}
