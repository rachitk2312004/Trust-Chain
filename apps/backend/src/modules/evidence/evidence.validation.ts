import { createHash, randomUUID } from "node:crypto";
import {
  ComplianceFrameworkList,
  EvidenceDefaults,
  EvidenceLinkTypeList,
  EvidenceStatuses,
  type ComplianceFramework,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type EvidenceContentInput = {
  contentText?: string | null;
  objectKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksumSha256?: string | null;
};

export type EvidenceMetadata = {
  extractedAt: string;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number;
  extension: string | null;
  inferredKind: string;
  tags: string[];
  frameworks: ComplianceFramework[];
};

export function generateEvidencePublicCode(): string {
  return `EVD-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export function computeContentChecksum(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

export function normalizeTags(tags: string[] | undefined | null): string[] {
  if (!tags?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim().toLowerCase().slice(0, 64);
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
    if (out.length >= EvidenceDefaults.maxTags) break;
  }
  return out;
}

export function normalizeFrameworks(
  frameworks: string[] | undefined | null,
): ComplianceFramework[] {
  if (!frameworks?.length) return [];
  const allowed = new Set(ComplianceFrameworkList as readonly string[]);
  return [...new Set(frameworks.map((f) => f.trim().toLowerCase()).filter((f) => allowed.has(f)))] as ComplianceFramework[];
}

export function extractExtension(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const idx = fileName.lastIndexOf(".");
  if (idx < 0 || idx === fileName.length - 1) return null;
  return fileName.slice(idx + 1).toLowerCase().slice(0, 16);
}

export function inferEvidenceKind(input: {
  mimeType?: string | null;
  fileName?: string | null;
  extension?: string | null;
}): string {
  const mime = (input.mimeType ?? "").toLowerCase();
  const ext = input.extension ?? extractExtension(input.fileName);
  if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext ?? "")) {
    return "image";
  }
  if (mime === "application/pdf" || ext === "pdf") return "pdf";
  if (mime.includes("json") || ext === "json") return "json";
  if (mime.startsWith("text/") || ["txt", "md", "csv", "log"].includes(ext ?? "")) {
    return "text";
  }
  return "binary";
}

export function extractEvidenceMetadata(input: {
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  tags?: string[] | null;
  frameworks?: string[] | null;
  extra?: Record<string, unknown> | null;
}): EvidenceMetadata & { extra: Record<string, unknown> } {
  const tags = normalizeTags(input.tags);
  const frameworks = normalizeFrameworks(input.frameworks);
  const extension = extractExtension(input.fileName);
  return {
    extractedAt: new Date().toISOString(),
    fileName: input.fileName ?? null,
    mimeType: input.mimeType ?? null,
    sizeBytes: Math.max(0, input.sizeBytes ?? 0),
    extension,
    inferredKind: inferEvidenceKind({
      mimeType: input.mimeType,
      fileName: input.fileName,
      extension,
    }),
    tags,
    frameworks,
    extra: input.extra ?? {},
  };
}

export function resolveChecksum(input: EvidenceContentInput): {
  checksumSha256: string;
  sizeBytes: number;
  contentText: string | null;
} {
  const contentText = input.contentText ?? null;
  if (contentText != null) {
    if (Buffer.byteLength(contentText, "utf8") > EvidenceDefaults.maxContentBytes) {
      throw new AppError(400, "VALIDATION_ERROR", "Evidence content exceeds size limit");
    }
    const checksumSha256 = computeContentChecksum(contentText);
    if (input.checksumSha256 && input.checksumSha256.toLowerCase() !== checksumSha256) {
      throw new AppError(400, "EVIDENCE_CHECKSUM_MISMATCH", "Provided checksum does not match content");
    }
    return {
      checksumSha256,
      sizeBytes: input.sizeBytes ?? Buffer.byteLength(contentText, "utf8"),
      contentText,
    };
  }

  if (!input.checksumSha256 || !/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "checksumSha256 is required when contentText is omitted",
    );
  }
  return {
    checksumSha256: input.checksumSha256.toLowerCase(),
    sizeBytes: Math.max(0, input.sizeBytes ?? 0),
    contentText: null,
  };
}

export type EvidenceValidationResult = {
  valid: boolean;
  checksumOk: boolean;
  status: string;
  issues: string[];
  checkedAt: string;
};

export function validateEvidenceRecord(input: {
  checksumSha256: string;
  contentText?: string | null;
  status?: string;
  frameworks?: string[];
  tags?: string[];
}): EvidenceValidationResult {
  const issues: string[] = [];
  let checksumOk = true;

  if (!/^[a-f0-9]{64}$/i.test(input.checksumSha256)) {
    checksumOk = false;
    issues.push("Invalid checksum format");
  }
  if (input.contentText != null) {
    const actual = computeContentChecksum(input.contentText);
    if (actual !== input.checksumSha256.toLowerCase()) {
      checksumOk = false;
      issues.push("Content checksum mismatch");
    }
  }
  if (input.frameworks) {
    const bad = input.frameworks.filter(
      (f) => !(ComplianceFrameworkList as readonly string[]).includes(f),
    );
    if (bad.length) issues.push(`Unknown frameworks: ${bad.join(", ")}`);
  }
  if (input.tags && input.tags.length > EvidenceDefaults.maxTags) {
    issues.push("Too many tags");
  }

  const valid = checksumOk && issues.length === 0;
  return {
    valid,
    checksumOk,
    status: valid ? EvidenceStatuses.validated : EvidenceStatuses.rejected,
    issues,
    checkedAt: new Date().toISOString(),
  };
}

export function assertValidLinkTarget(targetType: string, targetId: string): void {
  if (!(EvidenceLinkTypeList as readonly string[]).includes(targetType)) {
    throw new AppError(400, "VALIDATION_ERROR", `Unsupported link target type: ${targetType}`);
  }
  if (!targetId.trim()) {
    throw new AppError(400, "VALIDATION_ERROR", "targetId is required");
  }
}

export function nextVersionNumber(current: number): number {
  return Math.max(1, current) + 1;
}

export function buildCustodyIntegrityHash(input: {
  evidenceId: string;
  action: string;
  actorUserId: string | null;
  previousHash: string | null;
  createdAt: string;
  details: unknown;
}): string {
  const payload = JSON.stringify({
    evidenceId: input.evidenceId,
    action: input.action,
    actorUserId: input.actorUserId,
    previousHash: input.previousHash,
    createdAt: input.createdAt,
    details: input.details ?? null,
  });
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function verifyCustodyChain(
  events: Array<{ previousHash: string | null; integrityHash: string }>,
): boolean {
  let previous: string | null = null;
  for (let i = 0; i < events.length; i += 1) {
    const event = events[i]!;
    if (i === 0) {
      if (event.previousHash != null) return false;
    } else if (event.previousHash !== previous) {
      return false;
    }
    previous = event.integrityHash;
  }
  return true;
}
