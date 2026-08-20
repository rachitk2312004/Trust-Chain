import { DefaultTenantQuotaLimits } from "@trustchain/config";
import { prisma, Prisma } from "@trustchain/database";
import {
  defaultTenantQuotaLimits,
  emptyTenantQuotaUsage,
  parseTenantQuotaLimits,
  type TenantQuotaLimits,
  type TenantQuotaUsage,
} from "./admin.tenants.workflow.js";

export function toPublicTenant(row: {
  id: string;
  name: string;
  slug: string;
  status: string;
  parentOrganizationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    parentOrganizationId: row.parentOrganizationId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicQuota(row: {
  id: string;
  organizationId: string;
  limitsJson: Prisma.JsonValue;
  usageJson: Prisma.JsonValue | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    limits: parseTenantQuotaLimits(row.limitsJson),
    usage: row.usageJson
      ? parseTenantQuotaLimits(row.usageJson)
      : emptyTenantQuotaUsage(),
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicLifecycleEvent(row: {
  id: string;
  organizationId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorUserId: string | null;
  metaJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    eventType: row.eventType,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    actorUserId: row.actorUserId,
    meta: row.metaJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listTenants(input: {
  search?: string;
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.OrganizationWhereInput = {
    ...(input.status
      ? {
          status:
            input.status === "suspended"
              ? { in: ["suspended", "disabled"] }
              : input.status,
        }
      : {}),
    ...(input.search
      ? {
          OR: [
            { name: { contains: input.search, mode: "insensitive" } },
            { slug: { contains: input.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
      include: {
        tenantQuota: true,
        _count: {
          select: {
            memberships: true,
            children: true,
            documents: true,
            certificates: true,
            signatures: true,
          },
        },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  return { items, total, limit: input.limit, offset: input.offset };
}

export async function findTenantById(tenantId: string) {
  return prisma.organization.findUnique({
    where: { id: tenantId },
    include: {
      tenantQuota: true,
      parent: { select: { id: true, name: true, slug: true, status: true } },
      children: { select: { id: true, name: true, slug: true, status: true }, take: 50 },
      memberships: {
        take: 50,
        include: {
          user: {
            select: { id: true, email: true, firstName: true, lastName: true, status: true },
          },
        },
      },
      roleBindings: {
        take: 50,
        include: {
          role: true,
          user: { select: { id: true, email: true, firstName: true, lastName: true } },
        },
      },
      _count: {
        select: {
          memberships: true,
          children: true,
          documents: true,
          certificates: true,
          signatures: true,
        },
      },
    },
  });
}

export async function findTenantSlug(slug: string) {
  return prisma.organization.findUnique({ where: { slug: slug.toLowerCase() } });
}

export async function createTenantRecord(input: {
  name: string;
  slug: string;
  parentOrganizationId?: string | null;
  status?: string;
}) {
  return prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug.toLowerCase(),
      parentOrganizationId: input.parentOrganizationId ?? null,
      status: input.status ?? "active",
    },
  });
}

export async function updateTenantRecord(
  tenantId: string,
  input: { name?: string; status?: string; parentOrganizationId?: string | null },
) {
  return prisma.organization.update({
    where: { id: tenantId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.parentOrganizationId !== undefined
        ? { parentOrganizationId: input.parentOrganizationId }
        : {}),
    },
  });
}

export async function upsertTenantQuota(input: {
  organizationId: string;
  limits: TenantQuotaLimits;
  usage?: TenantQuotaUsage | null;
  updatedById?: string | null;
}) {
  const limitsJson = input.limits as unknown as Prisma.InputJsonValue;
  const usageJson =
    input.usage === undefined
      ? undefined
      : ((input.usage ?? emptyTenantQuotaUsage()) as unknown as Prisma.InputJsonValue);

  return prisma.tenantQuota.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      limitsJson,
      usageJson: usageJson ?? (emptyTenantQuotaUsage() as unknown as Prisma.InputJsonValue),
      updatedById: input.updatedById ?? null,
    },
    update: {
      limitsJson,
      ...(usageJson !== undefined ? { usageJson } : {}),
      updatedById: input.updatedById ?? null,
    },
  });
}

export async function getTenantQuota(organizationId: string) {
  return prisma.tenantQuota.findUnique({ where: { organizationId } });
}

export async function createLifecycleEvent(input: {
  organizationId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actorUserId?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  return prisma.tenantLifecycleEvent.create({
    data: {
      organizationId: input.organizationId,
      eventType: input.eventType,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorUserId: input.actorUserId ?? null,
      metaJson: (input.meta as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

export async function listLifecycleEvents(organizationId: string, take = 50) {
  return prisma.tenantLifecycleEvent.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function measureTenantUsage(organizationId: string): Promise<TenantQuotaUsage> {
  const [users, organizations, documents, certificates, signatures, storageAgg] =
    await Promise.all([
      prisma.membership.count({ where: { organizationId, status: "active" } }),
      prisma.organization.count({ where: { parentOrganizationId: organizationId } }),
      prisma.document.count({ where: { organizationId } }),
      prisma.certificate.count({ where: { organizationId } }),
      prisma.signature.count({ where: { organizationId } }),
      prisma.documentVersion.aggregate({
        where: { document: { organizationId } },
        _sum: { sizeBytes: true },
      }),
    ]);

  return {
    users,
    organizations,
    documents,
    certificates,
    signatures,
    storageBytes: Number(storageAgg._sum.sizeBytes ?? 0n),
  };
}

export async function ensureDefaultQuota(
  organizationId: string,
  limits?: Partial<TenantQuotaLimits> | null,
  updatedById?: string | null,
) {
  const existing = await getTenantQuota(organizationId);
  if (existing) return existing;
  const usage = await measureTenantUsage(organizationId);
  return upsertTenantQuota({
    organizationId,
    limits: defaultTenantQuotaLimits(limits),
    usage,
    updatedById,
  });
}

export { DefaultTenantQuotaLimits };
