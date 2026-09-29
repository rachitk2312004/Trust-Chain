import { inflateSync } from "node:zlib";
import { CertificateStatuses, RoleKeys, VerificationOutcomes } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { contentHashesEqual, normalizeContentHash } from "../../../lib/contentHash.js";
import { userHasRole } from "../../auth/rbac.repository.js";
import { consumeOrgMetric } from "../../billing/billing.entitlements.js";
import { BillingFeatureKeys, BillingMetricKeys } from "../../billing/billing.plans.js";
import { summarizeBulkResults } from "./verification.bulk.js";
import { saveCheckRun } from "./verification.checks.js";
import { identityMismatchMessage, looksLikePersonName, namesMatch } from "./verification.names.js";

export const INTAKE_VERIFY_LIMIT = 50;
export const CERTIFICATE_PUBLIC_ID_RE = /CERT-[A-Z0-9]+-[0-9A-F]+/gi;
export const CERTIFICATE_UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i;

export type IntakeSubmission = {
  fileName: string;
  contentHash: string;
  publicIds?: string[];
  fileBase64?: string;
  claimedName?: string;
};

export type IntakeMatchInput = {
  fileName: string;
  contentHash: string;
  claimedFromContent: boolean;
  namedCertificate: {
    id?: string;
    publicId: string;
    status: string;
    storedHash: string | null;
    title: string;
    recipientName: string;
    documentId?: string | null;
  } | null;
  hashCertificate: {
    id?: string;
    publicId: string;
    status: string;
    storedHash: string | null;
    title: string;
    recipientName: string;
    documentId?: string | null;
  } | null;
};

export type IntakeItemResult = {
  label: string;
  fileName: string;
  contentHash: string;
  category: "intake";
  outcome: string;
  valid: boolean;
  verdict: "authentic" | "tampered" | "revoked" | "expired" | "not_found" | "identity_mismatch";
  publicId?: string;
  certificateId?: string;
  documentId?: string;
  recipientName?: string;
  claimedName?: string;
  printedName?: string;
  title?: string;
  error?: string;
};

export function collectCertificatePublicIds(text: string, into: Set<string> = new Set()): Set<string> {
  for (const match of text.matchAll(CERTIFICATE_PUBLIC_ID_RE)) {
    into.add(match[0].toUpperCase());
  }
  return into;
}

export function collectIdsFromPdfHexStrings(text: string, into: Set<string> = new Set()): Set<string> {
  for (const match of text.matchAll(/<([0-9A-Fa-f]{16,})>/g)) {
    const hex = match[1];
    if (!hex || hex.length % 2) continue;
    try {
      const decoded = Buffer.from(hex, "hex").toString("latin1");
      collectCertificatePublicIds(decoded, into);
    } catch {
      // ignore malformed hex
    }
  }
  return into;
}

export function extractCertificatePublicId(fileName: string): string | null {
  const match = fileName.match(CERTIFICATE_PUBLIC_ID_RE);
  return match ? match[0].toUpperCase() : null;
}

export function extractCertificateUuid(fileName: string): string | null {
  const match = fileName.match(CERTIFICATE_UUID_RE);
  return match ? match[0].toLowerCase() : null;
}

export function collectDecodedPdfStrings(text: string, into: string[] = []): string[] {
  for (const match of text.matchAll(/<([0-9A-Fa-f]{16,})>/g)) {
    const hex = match[1];
    if (!hex || hex.length % 2) continue;
    try {
      const decoded = Buffer.from(hex, "hex").toString("latin1");
      const cleaned = decoded.replace(/[^\x20-\x7E]/g, " ").replace(/\s+/g, " ").trim();
      if (cleaned.length >= 2) into.push(cleaned);
    } catch {
      // ignore
    }
  }
  return into;
}

export function extractPdfDecodedText(bytes: Buffer): string {
  const parts: string[] = [];
  const latin1 = bytes.toString("latin1");
  collectDecodedPdfStrings(latin1, parts);

  const streamHeader = /\/Length\s+(\d+)\s*>>\s*stream\r?\n/g;
  let header: RegExpExecArray | null;
  while ((header = streamHeader.exec(latin1))) {
    const length = Number(header[1]);
    const start = header.index + header[0].length;
    const chunk = bytes.subarray(start, start + length);
    try {
      const inflated = inflateSync(chunk).toString("latin1");
      collectDecodedPdfStrings(inflated, parts);
      const plain = inflated.replace(/[^\x20-\x7E\n]/g, " ");
      if (plain.trim()) parts.push(plain);
    } catch {
      // not a zlib stream
    }
  }
  return parts.join("\n");
}

export function extractPrintedNameFromPdfText(text: string, issuedName?: string | null): string | null {
  if (issuedName) {
    const issued = issuedName.trim();
    if (issued && text.toLowerCase().includes(issued.toLowerCase())) {
      return issued;
    }
  }
  const skip =
    /cert-|trust-?chain|certificate|attendance|northstar|verify|issued|organization|authorized|signature|scan to|valid through|employee|achievement|award|completion|excellence|honor|credential|distinction|registrar|director|dean|professional|bearer|named below|sample recipient/i;
  const candidates = text
    .split(/[\n|/]+/)
    .map((part) => part.replace(/https?:\/\/\S+/gi, " ").trim())
    .flatMap((part) => part.split(/\s{2,}|\u0000/))
    .map((part) => part.trim())
    .filter((part) => looksLikePersonName(part) && !skip.test(part));
  // Prefer multi-word person names over single tokens.
  return (
    candidates.sort((a, b) => {
      const aWords = a.split(/\s+/).length;
      const bWords = b.split(/\s+/).length;
      if (bWords !== aWords) return bWords - aWords;
      return b.length - a.length;
    })[0] ?? null
  );
}

export function extractClaimedNameFromFileName(fileName: string): string | null {
  const base = fileName.replace(/\.[^.]+$/, "");
  const cleaned = base
    .replace(CERTIFICATE_PUBLIC_ID_RE, " ")
    .replace(CERTIFICATE_UUID_RE, " ")
    .replace(/[_\-()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length < 2 || /^[0-9]+$/.test(cleaned)) return null;
  if (/^[0-9a-f]{8}$/i.test(cleaned.split(" ")[0] ?? "")) return null;
  if (!looksLikePersonName(cleaned)) return null;
  return cleaned;
}

export function extractCertificatePublicIdsFromPdfBytes(bytes: Buffer): string[] {
  const ids = new Set<string>();
  const latin1 = bytes.toString("latin1");
  collectCertificatePublicIds(latin1, ids);
  collectIdsFromPdfHexStrings(latin1, ids);

  const streamHeader = /\/Length\s+(\d+)\s*>>\s*stream\r?\n/g;
  let header: RegExpExecArray | null;
  while ((header = streamHeader.exec(latin1))) {
    const length = Number(header[1]);
    const start = header.index + header[0].length;
    const chunk = bytes.subarray(start, start + length);
    try {
      const inflated = inflateSync(chunk).toString("latin1");
      collectCertificatePublicIds(inflated, ids);
      collectIdsFromPdfHexStrings(inflated, ids);
    } catch {
      // not a zlib stream
    }
  }
  return [...ids];
}

function statusVerdict(
  cert: NonNullable<IntakeMatchInput["namedCertificate"]>,
  extraError?: string,
): ReturnType<typeof decideIntakeMatch> {
  if (cert.status === CertificateStatuses.revoked) {
    return {
      verdict: "revoked",
      outcome: VerificationOutcomes.revoked,
      valid: false,
      error: extraError ?? "This is a real TrustChain PDF, but the certificate was revoked.",
      certificate: cert,
    };
  }
  if (cert.status === CertificateStatuses.expired) {
    return {
      verdict: "expired",
      outcome: VerificationOutcomes.expired,
      valid: false,
      error: extraError ?? "This is a real TrustChain PDF, but the certificate has expired.",
      certificate: cert,
    };
  }
  return {
    verdict: "authentic",
    outcome: VerificationOutcomes.valid,
    valid: cert.status === CertificateStatuses.issued,
    error: extraError,
    certificate: cert,
  };
}

export function decideIntakeMatch(input: IntakeMatchInput): {
  verdict: IntakeItemResult["verdict"];
  outcome: string;
  valid: boolean;
  error?: string;
  certificate: IntakeMatchInput["namedCertificate"] | IntakeMatchInput["hashCertificate"];
} {
  const submitted = normalizeContentHash(input.contentHash);
  const named = input.namedCertificate;
  const hashed = input.hashCertificate;

  if (named) {
    const stored = named.storedHash ? normalizeContentHash(named.storedHash) : null;
    const bytesMatch = Boolean(stored && contentHashesEqual(stored, submitted));
    if (bytesMatch || input.claimedFromContent) {
      return statusVerdict(named);
    }
    // CERT ID matched but stored PDF hash is missing (artifact never uploaded / lost).
    // Treat as the issued certificate rather than a fake file.
    if (!stored) {
      return statusVerdict(named);
    }
    return {
      verdict: "tampered",
      outcome: VerificationOutcomes.tampered,
      valid: false,
      error:
        "The file name belongs to a TrustChain certificate, but this file is not the issued PDF.",
      certificate: named,
    };
  }

  if (hashed) {
    return statusVerdict(hashed);
  }

  return {
    verdict: "not_found",
    outcome: VerificationOutcomes.missing,
    valid: false,
    error: "Not issued. No TrustChain certificate in this organization matches this file.",
    certificate: null,
  };
}

function toPublicCert(row: {
  id: string;
  publicId: string;
  status: string;
  title: string;
  recipientName: string;
  documentId: string | null;
  document: { currentVersion: { contentHash: string } | null } | null;
}) {
  return {
    id: row.id,
    publicId: row.publicId,
    status: row.status,
    title: row.title,
    recipientName: row.recipientName,
    documentId: row.documentId,
    storedHash: row.document?.currentVersion?.contentHash ?? null,
  };
}

const certSelect = {
  id: true,
  publicId: true,
  status: true,
  title: true,
  recipientName: true,
  documentId: true,
  document: { select: { currentVersion: { select: { contentHash: true } } } },
} as const;

async function findCertificateByPublicId(organizationId: string, publicId: string) {
  const row = await prisma.certificate.findFirst({
    where: { organizationId, publicId: { equals: publicId, mode: "insensitive" } },
    select: certSelect,
  });
  return row ? toPublicCert(row) : null;
}

async function findCertificateById(organizationId: string, certificateId: string) {
  const row = await prisma.certificate.findFirst({
    where: { organizationId, id: certificateId },
    select: certSelect,
  });
  return row ? toPublicCert(row) : null;
}

async function findCertificateByHash(organizationId: string, contentHash: string) {
  const version = await prisma.documentVersion.findFirst({
    where: {
      contentHash,
      document: { organizationId, deletedAt: null },
    },
    include: {
      document: {
        select: {
          id: true,
          certificates: {
            orderBy: { issuedAt: "desc" },
            take: 1,
            select: {
              id: true,
              publicId: true,
              status: true,
              title: true,
              recipientName: true,
              documentId: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const cert = version?.document.certificates[0];
  if (!cert) return null;
  return {
    id: cert.id,
    publicId: cert.publicId,
    status: cert.status,
    title: cert.title,
    recipientName: cert.recipientName,
    documentId: cert.documentId,
    storedHash: version.contentHash,
  };
}

export async function runIntakeVerification(
  userId: string,
  organizationId: string,
  submissions: IntakeSubmission[],
) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization staff role required");
  await consumeOrgMetric(
    userId,
    organizationId,
    BillingMetricKeys.orgVerifications,
    Math.max(1, submissions.length),
    BillingFeatureKeys.orgVerification,
  );

  const items = submissions.slice(0, INTAKE_VERIFY_LIMIT).map((row) => ({
    fileName: row.fileName.trim().slice(0, 240),
    contentHash: normalizeContentHash(row.contentHash) ?? "",
    publicIds: (row.publicIds ?? []).map((id) => id.toUpperCase()),
    fileBase64: row.fileBase64,
    claimedName: row.claimedName?.trim() || extractClaimedNameFromFileName(row.fileName),
  }));
  if (!items.length) {
    throw new AppError(400, "INTAKE_EMPTY", "Drop at least one file to verify.");
  }
  if (items.some((row) => !/^[a-f0-9]{64}$/.test(row.contentHash))) {
    throw new AppError(400, "INVALID_HASH", "Each file must include a 64-character SHA-256 hash.");
  }

  const results: IntakeItemResult[] = [];
  for (const item of items) {
    const pdfBytes = item.fileBase64 ? Buffer.from(item.fileBase64, "base64") : null;
    const fromPdf = pdfBytes ? extractCertificatePublicIdsFromPdfBytes(pdfBytes) : [];
    const contentIds = [...new Set([...item.publicIds, ...fromPdf])];
    const fromName = extractCertificatePublicId(item.fileName);
    const uuid = extractCertificateUuid(item.fileName);

    let named =
      (contentIds[0] ? await findCertificateByPublicId(organizationId, contentIds[0]) : null) ??
      (fromName ? await findCertificateByPublicId(organizationId, fromName) : null);
    if (!named && uuid) {
      named = await findCertificateById(organizationId, uuid);
    }
    const hashed = await findCertificateByHash(organizationId, item.contentHash);
    const claimedFromContent = contentIds.some(
      (id) => id === named?.publicId.toUpperCase() || id === named?.publicId,
    );

    const decision = decideIntakeMatch({
      fileName: item.fileName,
      contentHash: item.contentHash,
      claimedFromContent,
      namedCertificate: named,
      hashCertificate: hashed,
    });
    const cert = decision.certificate;
    const pdfText = pdfBytes ? extractPdfDecodedText(pdfBytes) : "";
    const printedName = pdfText ? extractPrintedNameFromPdfText(pdfText, cert?.recipientName) : null;
    // CSV / form / person-like filename only — never URL hosts scraped from PDF chrome.
    const claimedName =
      item.claimedName && looksLikePersonName(item.claimedName) ? item.claimedName.trim() : undefined;
    const printedPerson =
      printedName && looksLikePersonName(printedName) ? printedName.trim() : undefined;
    const issuedName = cert?.recipientName;
    let verdict = decision.verdict;
    let outcome = decision.outcome;
    let valid = decision.valid;
    let error = decision.error;

    if (cert && issuedName) {
      if (claimedName && !namesMatch(claimedName, issuedName)) {
        verdict = "identity_mismatch";
        outcome = VerificationOutcomes.invalid;
        valid = false;
        error = identityMismatchMessage(issuedName, claimedName);
      } else if (!claimedName && printedPerson && !namesMatch(printedPerson, issuedName)) {
        verdict = "identity_mismatch";
        outcome = VerificationOutcomes.invalid;
        valid = false;
        error = identityMismatchMessage(issuedName, printedPerson);
      }
    }

    results.push({
      label: item.fileName,
      fileName: item.fileName,
      contentHash: item.contentHash,
      category: "intake",
      outcome,
      valid,
      verdict,
      publicId: cert?.publicId,
      certificateId: named?.id ?? hashed?.id ?? cert?.id,
      documentId: named?.documentId ?? hashed?.documentId ?? undefined,
      recipientName: issuedName,
      claimedName,
      printedName: printedPerson ?? printedName ?? undefined,
      title: cert?.title,
      error,
    });
  }

  await saveCheckRun(
    userId,
    organizationId,
    "intake",
    results.map((row) => ({
      inputLabel: row.fileName,
      fileName: row.fileName,
      outcome: row.outcome,
      verdict: row.verdict,
      valid: row.valid,
      recipientName: row.recipientName,
      publicId: row.publicId,
      title: row.title,
      uniqueId: row.publicId ?? row.contentHash,
      contentHash: row.contentHash,
      certificateId: row.certificateId,
      documentId: row.documentId,
      detail: row.error,
    })),
  );

  return {
    category: "intake" as const,
    summary: summarizeBulkResults(
      results.map((row) => ({
        label: row.label,
        category: "hashes",
        outcome: row.outcome,
        valid: row.valid,
      })),
    ),
    results,
  };
}
