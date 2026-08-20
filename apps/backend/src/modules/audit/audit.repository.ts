import { AuditDefaults, SearchEntityTypes } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import {
  buildAuditEvent,
  type AuditEventInput,
  type AuditEventRecord,
  type AuditFilter,
} from "./audit.timeline.js";
import { indexAuditEvent } from "../search/search.indexer.js";
import { upsertSearchDocuments } from "../search/search.repository.js";

export function toPublicAuditEvent(row: {
  id: string;
  correlationId: string;
  requestId: string | null;
  source: string;
  action: string;
  actorUserId: string | null;
  actorIp: string | null;
  organizationId: string | null;
  resourceType: string | null;
  resourceId: string | null;
  success: boolean;
  metaJson: Prisma.JsonValue | null;
  integrityHash: string;
  previousHash: string | null;
  createdAt: Date;
}): AuditEventRecord {
  return {
    id: row.id,
    correlationId: row.correlationId,
    requestId: row.requestId,
    source: row.source,
    action: row.action,
    actorUserId: row.actorUserId,
    actorIp: row.actorIp,
    organizationId: row.organizationId,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    success: row.success,
    meta: row.metaJson,
    integrityHash: row.integrityHash,
    previousHash: row.previousHash,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildWhere(filters: AuditFilter): Prisma.PlatformAuditEventWhereInput {
  const where: Prisma.PlatformAuditEventWhereInput = {};
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.action) where.action = filters.action;
  if (filters.actorUserId) where.actorUserId = filters.actorUserId;
  if (filters.resourceType) where.resourceType = filters.resourceType;
  if (filters.resourceId) where.resourceId = filters.resourceId;
  if (filters.correlationId) where.correlationId = filters.correlationId;
  if (filters.requestId) where.requestId = filters.requestId;
  if (filters.source) where.source = filters.source;
  if (filters.success !== undefined) where.success = filters.success;
  if (filters.actorIp) where.actorIp = filters.actorIp;
  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }
  if (filters.q) {
    const q = filters.q;
    where.OR = [
      { action: { contains: q, mode: "insensitive" } },
      { correlationId: { contains: q, mode: "insensitive" } },
      { requestId: { contains: q, mode: "insensitive" } },
      { resourceType: { contains: q, mode: "insensitive" } },
      { resourceId: { contains: q, mode: "insensitive" } },
      { actorIp: { contains: q, mode: "insensitive" } },
      { source: { contains: q, mode: "insensitive" } },
    ];
  }
  return where;
}

export async function createPlatformAuditEvent(input: AuditEventInput) {
  let previousHash = input.previousHash ?? null;
  if (!previousHash && input.correlationId) {
    const last = await prisma.platformAuditEvent.findFirst({
      where: { correlationId: input.correlationId },
      orderBy: { createdAt: "desc" },
      select: { integrityHash: true },
    });
    previousHash = last?.integrityHash ?? null;
  }

  const built = buildAuditEvent({ ...input, previousHash });
  const row = await prisma.platformAuditEvent.create({
    data: {
      id: built.id,
      correlationId: built.correlationId,
      requestId: built.requestId,
      source: built.source,
      action: built.action,
      actorUserId: built.actorUserId,
      actorIp: built.actorIp,
      organizationId: built.organizationId,
      resourceType: built.resourceType,
      resourceId: built.resourceId,
      success: built.success,
      metaJson: (built.meta as Prisma.InputJsonValue) ?? undefined,
      integrityHash: built.integrityHash,
      previousHash: built.previousHash,
      createdAt: new Date(built.createdAt),
    },
  });

  // Best-effort search indexing (non-blocking for audit write path).
  try {
    const indexed = indexAuditEvent({
      id: row.id,
      organizationId: row.organizationId,
      action: row.action,
      targetType: row.resourceType,
      targetId: row.resourceId,
      success: row.success,
      createdAt: row.createdAt,
    });
    await upsertSearchDocuments([
      {
        ...indexed,
        keywords: `${indexed.keywords} ${row.correlationId} ${row.requestId ?? ""} ${row.actorIp ?? ""} ${row.source}`,
        exactKeys: `${indexed.exactKeys} ${row.correlationId} ${row.requestId ?? ""}`.trim(),
      },
    ]);
  } catch {
    // Index failures must not roll back immutable audit writes.
  }

  return toPublicAuditEvent(row);
}

export async function getPlatformAuditEvent(id: string) {
  const row = await prisma.platformAuditEvent.findUnique({ where: { id } });
  return row ? toPublicAuditEvent(row) : null;
}

export async function listPlatformAuditEvents(
  filters: AuditFilter & { limit?: number; offset?: number },
) {
  const where = buildWhere(filters);
  const take = filters.limit ?? AuditDefaults.defaultLimit;
  const skip = filters.offset ?? 0;
  const [rows, total] = await Promise.all([
    prisma.platformAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.platformAuditEvent.count({ where }),
  ]);
  return {
    events: rows.map(toPublicAuditEvent),
    total,
    limit: take,
    offset: skip,
  };
}

export async function listTimelineCandidates(
  filters: AuditFilter & { limit?: number },
) {
  const where = buildWhere(filters);
  const rows = await prisma.platformAuditEvent.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: filters.limit ?? AuditDefaults.timelineLimit,
  });
  return rows.map(toPublicAuditEvent);
}

export async function getAuditStatus(organizationId?: string) {
  const where = organizationId ? { organizationId } : {};
  const [total, successCount, failureCount, bySource, latest, latestExport] =
    await Promise.all([
      prisma.platformAuditEvent.count({ where }),
      prisma.platformAuditEvent.count({ where: { ...where, success: true } }),
      prisma.platformAuditEvent.count({ where: { ...where, success: false } }),
      prisma.platformAuditEvent.groupBy({
        by: ["source"],
        where,
        _count: { _all: true },
      }),
      prisma.platformAuditEvent.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.auditExportJob.findFirst({
        where: organizationId ? { organizationId } : {},
        orderBy: { createdAt: "desc" },
      }),
    ]);

  return {
    totalEvents: total,
    successCount,
    failureCount,
    bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count._all])),
    lastEventAt: latest?.createdAt?.toISOString() ?? null,
    latestExport: latestExport
      ? {
          id: latestExport.id,
          status: latestExport.status,
          format: latestExport.format,
          rowCount: latestExport.rowCount,
          finishedAt: latestExport.finishedAt?.toISOString() ?? null,
          createdAt: latestExport.createdAt.toISOString(),
        }
      : null,
    searchIndexedAs: SearchEntityTypes.auditEvent,
  };
}

export async function createAuditExportJob(input: {
  organizationId?: string | null;
  format: string;
  filters: Record<string, unknown>;
  triggeredById: string;
}) {
  return prisma.auditExportJob.create({
    data: {
      organizationId: input.organizationId ?? null,
      format: input.format,
      status: "running",
      filtersJson: input.filters as Prisma.InputJsonValue,
      triggeredById: input.triggeredById,
      startedAt: new Date(),
    },
  });
}

export async function finishAuditExportJob(
  jobId: string,
  result: {
    status: "completed" | "failed";
    rowCount: number;
    contentText?: string;
    errorMessage?: string;
  },
) {
  return prisma.auditExportJob.update({
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
