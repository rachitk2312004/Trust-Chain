import { EvidenceCustodyActions, type ComplianceFramework } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import {
  buildCustodyIntegrityHash,
  extractEvidenceMetadata,
  generateEvidencePublicCode,
  normalizeFrameworks,
  normalizeTags,
  resolveChecksum,
  validateEvidenceRecord,
} from "./evidence.validation.js";

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function toPublicEvidence(row: {
  id: string;
  organizationId: string;
  publicCode: string;
  title: string;
  description: string | null;
  status: string;
  currentVersion: number;
  checksumSha256: string;
  mimeType: string | null;
  fileName: string | null;
  sizeBytes: number;
  tagsJson: Prisma.JsonValue;
  frameworksJson: Prisma.JsonValue;
  metadataJson: Prisma.JsonValue | null;
  validationJson: Prisma.JsonValue | null;
  objectKey: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    publicCode: row.publicCode,
    title: row.title,
    description: row.description,
    status: row.status,
    currentVersion: row.currentVersion,
    checksumSha256: row.checksumSha256,
    mimeType: row.mimeType,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    tags: asStringArray(row.tagsJson),
    frameworks: asStringArray(row.frameworksJson),
    metadata: row.metadataJson,
    validation: row.validationJson,
    objectKey: row.objectKey,
    createdById: row.createdById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function appendCustody(input: {
  evidenceId: string;
  action: string;
  actorUserId?: string | null;
  actorIp?: string | null;
  details?: Record<string, unknown> | null;
}) {
  const last = await prisma.complianceEvidenceCustody.findFirst({
    where: { evidenceId: input.evidenceId },
    orderBy: { createdAt: "desc" },
    select: { integrityHash: true },
  });
  const createdAt = new Date().toISOString();
  const previousHash = last?.integrityHash ?? null;
  const integrityHash = buildCustodyIntegrityHash({
    evidenceId: input.evidenceId,
    action: input.action,
    actorUserId: input.actorUserId ?? null,
    previousHash,
    createdAt,
    details: input.details ?? null,
  });
  return prisma.complianceEvidenceCustody.create({
    data: {
      evidenceId: input.evidenceId,
      action: input.action,
      actorUserId: input.actorUserId ?? null,
      actorIp: input.actorIp ?? null,
      previousHash,
      integrityHash,
      detailsJson: (input.details as Prisma.InputJsonValue) ?? undefined,
      createdAt: new Date(createdAt),
    },
  });
}

export async function createEvidence(input: {
  organizationId: string;
  title: string;
  description?: string | null;
  contentText?: string | null;
  objectKey?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  checksumSha256?: string | null;
  tags?: string[];
  frameworks?: string[];
  metadata?: Record<string, unknown> | null;
  createdById: string;
  actorIp?: string | null;
}) {
  const resolved = resolveChecksum({
    contentText: input.contentText,
    objectKey: input.objectKey,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    checksumSha256: input.checksumSha256,
  });
  const meta = extractEvidenceMetadata({
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: resolved.sizeBytes,
    tags: input.tags,
    frameworks: input.frameworks,
    extra: input.metadata ?? {},
  });
  const validation = validateEvidenceRecord({
    checksumSha256: resolved.checksumSha256,
    contentText: resolved.contentText,
    frameworks: meta.frameworks,
    tags: meta.tags,
  });

  const row = await prisma.complianceEvidence.create({
    data: {
      organizationId: input.organizationId,
      publicCode: generateEvidencePublicCode(),
      title: input.title,
      description: input.description ?? null,
      status: validation.valid ? validation.status : "draft",
      currentVersion: 1,
      checksumSha256: resolved.checksumSha256,
      mimeType: input.mimeType ?? null,
      fileName: input.fileName ?? null,
      sizeBytes: resolved.sizeBytes,
      tagsJson: meta.tags,
      frameworksJson: meta.frameworks,
      metadataJson: meta as unknown as Prisma.InputJsonValue,
      contentText: resolved.contentText,
      objectKey: input.objectKey ?? null,
      validationJson: validation as unknown as Prisma.InputJsonValue,
      createdById: input.createdById,
      versions: {
        create: {
          version: 1,
          checksumSha256: resolved.checksumSha256,
          mimeType: input.mimeType ?? null,
          fileName: input.fileName ?? null,
          sizeBytes: resolved.sizeBytes,
          contentText: resolved.contentText,
          objectKey: input.objectKey ?? null,
          metadataJson: meta as unknown as Prisma.InputJsonValue,
          changeNote: "Initial collection",
          createdById: input.createdById,
        },
      },
    },
  });

  await appendCustody({
    evidenceId: row.id,
    action: EvidenceCustodyActions.collected,
    actorUserId: input.createdById,
    actorIp: input.actorIp,
    details: { publicCode: row.publicCode, version: 1 },
  });
  if (validation.valid) {
    await appendCustody({
      evidenceId: row.id,
      action: EvidenceCustodyActions.validated,
      actorUserId: input.createdById,
      actorIp: input.actorIp,
      details: validation,
    });
  }

  return toPublicEvidence(row);
}

export async function listEvidence(input: {
  organizationId: string;
  q?: string;
  status?: string;
  framework?: string;
  tag?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.ComplianceEvidenceWhereInput = {
    organizationId: input.organizationId,
  };
  if (input.status) where.status = input.status;
  if (input.q) {
    where.OR = [
      { title: { contains: input.q, mode: "insensitive" } },
      { description: { contains: input.q, mode: "insensitive" } },
      { publicCode: { contains: input.q, mode: "insensitive" } },
      { fileName: { contains: input.q, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    prisma.complianceEvidence.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(500, input.limit * 3),
      skip: input.offset,
    }),
    prisma.complianceEvidence.count({ where }),
  ]);

  let items = rows.map(toPublicEvidence);
  if (input.framework) {
    items = items.filter((e) => e.frameworks.includes(input.framework!));
  }
  if (input.tag) {
    const tag = input.tag.toLowerCase();
    items = items.filter((e) => e.tags.includes(tag));
  }

  return {
    evidence: items.slice(0, input.limit),
    total: input.framework || input.tag ? items.length : total,
    limit: input.limit,
    offset: input.offset,
  };
}

export async function getEvidence(id: string) {
  return prisma.complianceEvidence.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" } },
      links: { orderBy: { createdAt: "desc" } },
      custody: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function patchEvidence(
  id: string,
  input: {
    title?: string;
    description?: string | null;
    status?: string;
    tags?: string[];
    frameworks?: string[];
    metadata?: Record<string, unknown> | null;
    contentText?: string | null;
    objectKey?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
    checksumSha256?: string | null;
    changeNote?: string | null;
    revalidate?: boolean;
    actorUserId: string;
    actorIp?: string | null;
  },
) {
  const existing = await prisma.complianceEvidence.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Prisma.ComplianceEvidenceUpdateInput = {};
  let versioned = false;
  let nextVersion = existing.currentVersion;

  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;

  const tags =
    input.tags !== undefined ? normalizeTags(input.tags) : asStringArray(existing.tagsJson);
  const frameworks =
    input.frameworks !== undefined
      ? normalizeFrameworks(input.frameworks)
      : (asStringArray(existing.frameworksJson) as ComplianceFramework[]);

  if (input.tags !== undefined) data.tagsJson = tags;
  if (input.frameworks !== undefined) data.frameworksJson = frameworks;

  const contentChanging =
    input.contentText !== undefined ||
    input.checksumSha256 !== undefined ||
    input.objectKey !== undefined;

  if (contentChanging) {
    const resolved = resolveChecksum({
      contentText: input.contentText ?? existing.contentText,
      objectKey: input.objectKey ?? existing.objectKey,
      fileName: input.fileName ?? existing.fileName,
      mimeType: input.mimeType ?? existing.mimeType,
      sizeBytes: input.sizeBytes ?? existing.sizeBytes,
      checksumSha256: input.checksumSha256 ?? undefined,
    });
    nextVersion = existing.currentVersion + 1;
    versioned = true;
    data.currentVersion = nextVersion;
    data.checksumSha256 = resolved.checksumSha256;
    data.contentText = resolved.contentText;
    data.sizeBytes = resolved.sizeBytes;
    if (input.objectKey !== undefined) data.objectKey = input.objectKey;
    if (input.fileName !== undefined) data.fileName = input.fileName;
    if (input.mimeType !== undefined) data.mimeType = input.mimeType;

    const meta = extractEvidenceMetadata({
      fileName: input.fileName ?? existing.fileName,
      mimeType: input.mimeType ?? existing.mimeType,
      sizeBytes: resolved.sizeBytes,
      tags,
      frameworks,
      extra: input.metadata ?? (existing.metadataJson as Record<string, unknown> | null),
    });
    data.metadataJson = meta as unknown as Prisma.InputJsonValue;

    await prisma.complianceEvidenceVersion.create({
      data: {
        evidenceId: id,
        version: nextVersion,
        checksumSha256: resolved.checksumSha256,
        mimeType: input.mimeType ?? existing.mimeType,
        fileName: input.fileName ?? existing.fileName,
        sizeBytes: resolved.sizeBytes,
        contentText: resolved.contentText,
        objectKey: input.objectKey ?? existing.objectKey,
        metadataJson: meta as unknown as Prisma.InputJsonValue,
        changeNote: input.changeNote ?? `Version ${nextVersion}`,
        createdById: input.actorUserId,
      },
    });
  } else if (input.metadata !== undefined || input.tags !== undefined || input.frameworks !== undefined) {
    const meta = extractEvidenceMetadata({
      fileName: existing.fileName,
      mimeType: existing.mimeType,
      sizeBytes: existing.sizeBytes,
      tags,
      frameworks,
      extra: input.metadata ?? (existing.metadataJson as Record<string, unknown> | null),
    });
    data.metadataJson = meta as unknown as Prisma.InputJsonValue;
  }

  const contentForValidation =
    contentChanging && "contentText" in data
      ? (data.contentText as string | null)
      : existing.contentText;
  const checksumForValidation =
    contentChanging && typeof data.checksumSha256 === "string"
      ? data.checksumSha256
      : existing.checksumSha256;

  if (input.revalidate || contentChanging || input.frameworks !== undefined) {
    const validation = validateEvidenceRecord({
      checksumSha256: checksumForValidation,
      contentText: contentForValidation,
      frameworks,
      tags,
    });
    data.validationJson = validation as unknown as Prisma.InputJsonValue;
    if (input.status === undefined && validation.valid) {
      data.status = validation.status;
    }
  }

  const updated = await prisma.complianceEvidence.update({ where: { id }, data });

  if (input.tags !== undefined) {
    await appendCustody({
      evidenceId: id,
      action: EvidenceCustodyActions.tagged,
      actorUserId: input.actorUserId,
      actorIp: input.actorIp,
      details: { tags },
    });
  }
  if (versioned) {
    await appendCustody({
      evidenceId: id,
      action: EvidenceCustodyActions.versioned,
      actorUserId: input.actorUserId,
      actorIp: input.actorIp,
      details: { version: nextVersion, changeNote: input.changeNote ?? null },
    });
  }
  if (input.revalidate || contentChanging) {
    await appendCustody({
      evidenceId: id,
      action: EvidenceCustodyActions.validated,
      actorUserId: input.actorUserId,
      actorIp: input.actorIp,
      details: updated.validationJson as Record<string, unknown> | null,
    });
  }

  return toPublicEvidence(updated);
}

export async function linkEvidence(input: {
  evidenceId: string;
  targetType: string;
  targetId: string;
  label?: string | null;
  actorUserId: string;
  actorIp?: string | null;
}) {
  const link = await prisma.complianceEvidenceLink.create({
    data: {
      evidenceId: input.evidenceId,
      targetType: input.targetType,
      targetId: input.targetId,
      label: input.label ?? null,
      createdById: input.actorUserId,
    },
  });
  await appendCustody({
    evidenceId: input.evidenceId,
    action: EvidenceCustodyActions.linked,
    actorUserId: input.actorUserId,
    actorIp: input.actorIp,
    details: {
      targetType: input.targetType,
      targetId: input.targetId,
      label: input.label ?? null,
    },
  });
  return {
    id: link.id,
    evidenceId: link.evidenceId,
    targetType: link.targetType,
    targetId: link.targetId,
    label: link.label,
    createdAt: link.createdAt.toISOString(),
  };
}

export async function createEvidenceExportJob(input: {
  organizationId: string;
  format: string;
  filters: Record<string, unknown>;
  triggeredById: string;
}) {
  return prisma.complianceEvidenceExport.create({
    data: {
      organizationId: input.organizationId,
      format: input.format,
      status: "running",
      filtersJson: input.filters as Prisma.InputJsonValue,
      triggeredById: input.triggeredById,
      startedAt: new Date(),
    },
  });
}

export async function finishEvidenceExportJob(
  jobId: string,
  result: {
    status: "completed" | "failed";
    rowCount: number;
    contentText?: string;
    errorMessage?: string;
  },
) {
  return prisma.complianceEvidenceExport.update({
    where: { id: jobId },
    data: {
      status: result.status,
      rowCount: result.rowCount,
      contentText: result.contentText ?? null,
      errorMessage: result.errorMessage ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function listEvidenceForExport(organizationId: string) {
  return prisma.complianceEvidence.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 2000,
    include: {
      links: true,
      custody: { orderBy: { createdAt: "asc" } },
    },
  });
}
