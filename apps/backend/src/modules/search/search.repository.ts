import { SearchDefaults, SearchEntityTypes, type SearchEntityType } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import type { SearchableDocument } from "./search.scoring.js";

export function toSearchableDocument(row: {
  entityType: string;
  entityId: string;
  organizationId: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  keywords: string;
  exactKeys: string;
  createdAtRef: Date;
}): SearchableDocument {
  return {
    entityType: row.entityType,
    entityId: row.entityId,
    organizationId: row.organizationId,
    title: row.title,
    subtitle: row.subtitle,
    status: row.status,
    keywords: row.keywords,
    exactKeys: row.exactKeys,
    createdAtRef: row.createdAtRef,
  };
}

export async function upsertSearchDocuments(docs: SearchableDocument[]): Promise<number> {
  let count = 0;
  for (const doc of docs) {
    await prisma.searchIndexEntry.upsert({
      where: {
        entityType_entityId: {
          entityType: doc.entityType,
          entityId: doc.entityId,
        },
      },
      create: {
        entityType: doc.entityType,
        entityId: doc.entityId,
        organizationId: doc.organizationId,
        title: doc.title,
        subtitle: doc.subtitle,
        status: doc.status,
        keywords: doc.keywords,
        exactKeys: doc.exactKeys,
        createdAtRef: new Date(doc.createdAtRef),
        indexedAt: new Date(),
      },
      update: {
        organizationId: doc.organizationId,
        title: doc.title,
        subtitle: doc.subtitle,
        status: doc.status,
        keywords: doc.keywords,
        exactKeys: doc.exactKeys,
        createdAtRef: new Date(doc.createdAtRef),
        indexedAt: new Date(),
      },
    });
    count += 1;
  }
  return count;
}

export async function deleteSearchDocumentsForOrg(
  organizationId: string,
  entityTypes?: string[],
): Promise<number> {
  const result = await prisma.searchIndexEntry.deleteMany({
    where: {
      organizationId,
      ...(entityTypes?.length ? { entityType: { in: entityTypes } } : {}),
    },
  });
  return result.count;
}

export type SearchCandidateFilters = {
  organizationId?: string;
  entityTypes?: string[];
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  take?: number;
};

export async function loadSearchCandidates(
  filters: SearchCandidateFilters,
): Promise<SearchableDocument[]> {
  const where: Prisma.SearchIndexEntryWhereInput = {};
  if (filters.organizationId) where.organizationId = filters.organizationId;
  if (filters.entityTypes?.length) where.entityType = { in: filters.entityTypes };
  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    where.createdAtRef = {
      ...(filters.from ? { gte: new Date(filters.from) } : {}),
      ...(filters.to ? { lte: new Date(filters.to) } : {}),
    };
  }
  if (filters.q) {
    const q = filters.q.trim();
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { subtitle: { contains: q, mode: "insensitive" } },
      { keywords: { contains: q.toLowerCase() } },
      { exactKeys: { contains: q.toLowerCase() } },
    ];
  }

  const rows = await prisma.searchIndexEntry.findMany({
    where,
    orderBy: { createdAtRef: "desc" },
    take: filters.take ?? SearchDefaults.maxCandidates,
  });
  return rows.map(toSearchableDocument);
}

export async function getSearchIndexStatus(organizationId?: string) {
  const where = organizationId ? { organizationId } : {};
  const [total, byType, latest, latestJob] = await Promise.all([
    prisma.searchIndexEntry.count({ where }),
    prisma.searchIndexEntry.groupBy({
      by: ["entityType"],
      where,
      _count: { _all: true },
    }),
    prisma.searchIndexEntry.findFirst({
      where,
      orderBy: { indexedAt: "desc" },
      select: { indexedAt: true },
    }),
    prisma.searchIndexJob.findFirst({
      where: organizationId ? { organizationId } : {},
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    totalEntries: total,
    byEntityType: Object.fromEntries(
      byType.map((row) => [row.entityType, row._count._all]),
    ) as Record<string, number>,
    lastIndexedAt: latest?.indexedAt?.toISOString() ?? null,
    latestJob: latestJob
      ? {
          id: latestJob.id,
          status: latestJob.status,
          indexedCount: latestJob.indexedCount,
          errorMessage: latestJob.errorMessage,
          startedAt: latestJob.startedAt?.toISOString() ?? null,
          finishedAt: latestJob.finishedAt?.toISOString() ?? null,
          createdAt: latestJob.createdAt.toISOString(),
        }
      : null,
  };
}

export async function createSearchIndexJob(input: {
  organizationId?: string | null;
  entityTypes: string[];
  triggeredById: string;
}) {
  return prisma.searchIndexJob.create({
    data: {
      organizationId: input.organizationId ?? null,
      status: "running",
      entityTypesJson: input.entityTypes,
      triggeredById: input.triggeredById,
      startedAt: new Date(),
    },
  });
}

export async function finishSearchIndexJob(
  jobId: string,
  result: { status: "completed" | "failed"; indexedCount: number; errorMessage?: string },
) {
  return prisma.searchIndexJob.update({
    where: { id: jobId },
    data: {
      status: result.status,
      indexedCount: result.indexedCount,
      errorMessage: result.errorMessage ?? null,
      finishedAt: new Date(),
    },
  });
}

export async function fetchSourceDocuments(organizationId?: string, take = 2000) {
  return prisma.document.findMany({
    where: {
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      title: true,
      description: true,
      status: true,
      publicVerifyCode: true,
      createdAt: true,
    },
    take,
    orderBy: { createdAt: "desc" },
  });
}

export async function fetchSourceCertificates(organizationId?: string, take = 2000) {
  return prisma.certificate.findMany({
    where: organizationId ? { organizationId } : {},
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      title: true,
      description: true,
      recipientName: true,
      recipientEmail: true,
      status: true,
      createdAt: true,
    },
    take,
    orderBy: { createdAt: "desc" },
  });
}

export async function fetchSourceSignatures(organizationId?: string, take = 2000) {
  return prisma.signature.findMany({
    where: organizationId ? { organizationId } : {},
    select: {
      id: true,
      organizationId: true,
      publicId: true,
      status: true,
      algorithm: true,
      createdAt: true,
      document: { select: { title: true } },
    },
    take,
    orderBy: { createdAt: "desc" },
  });
}

export async function fetchSourceUsers(organizationId?: string, take = 2000) {
  if (organizationId) {
    const bindings = await prisma.roleBinding.findMany({
      where: { organizationId },
      select: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            status: true,
            createdAt: true,
          },
        },
      },
      take,
    });
    return bindings.map((b) => ({
      ...b.user,
      organizationId,
    }));
  }
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      createdAt: true,
    },
    take,
    orderBy: { createdAt: "desc" },
  });
  return users.map((u) => ({ ...u, organizationId: null as string | null }));
}

export async function fetchSourceOrganizations(organizationId?: string, take = 2000) {
  return prisma.organization.findMany({
    where: organizationId ? { id: organizationId } : {},
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
    },
    take,
    orderBy: { createdAt: "desc" },
  });
}

export async function fetchSourceAuditEvents(organizationId?: string, take = 2000) {
  return prisma.adminAuditLog.findMany({
    where: organizationId ? { organizationId } : {},
    select: {
      id: true,
      organizationId: true,
      action: true,
      targetType: true,
      targetId: true,
      success: true,
      createdAt: true,
    },
    take,
    orderBy: { createdAt: "desc" },
  });
}

export async function loadSourceForEntityType(
  entityType: SearchEntityType,
  organizationId?: string,
) {
  switch (entityType) {
    case SearchEntityTypes.document:
      return fetchSourceDocuments(organizationId);
    case SearchEntityTypes.certificate:
      return fetchSourceCertificates(organizationId);
    case SearchEntityTypes.signature: {
      const rows = await fetchSourceSignatures(organizationId);
      return rows.map((r) => ({
        id: r.id,
        organizationId: r.organizationId,
        publicId: r.publicId,
        status: r.status,
        algorithm: r.algorithm,
        documentTitle: r.document?.title ?? null,
        createdAt: r.createdAt,
      }));
    }
    case SearchEntityTypes.user:
      return fetchSourceUsers(organizationId);
    case SearchEntityTypes.organization:
      return fetchSourceOrganizations(organizationId);
    case SearchEntityTypes.auditEvent:
      return fetchSourceAuditEvents(organizationId);
    default:
      return [];
  }
}
