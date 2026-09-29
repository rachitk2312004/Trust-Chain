import { prisma } from "@trustchain/database";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  parent_organization_id: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

function toOrgRow(row: {
  id: string;
  name: string;
  slug: string;
  parentOrganizationId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): OrganizationRow {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    parent_organization_id: row.parentOrganizationId,
    status: row.status,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function createOrganization(input: {
  name: string;
  slug: string;
  parentOrganizationId?: string | null;
}): Promise<OrganizationRow> {
  const row = await prisma.organization.create({
    data: {
      name: input.name,
      slug: input.slug.toLowerCase(),
      parentOrganizationId: input.parentOrganizationId ?? null,
    },
  });
  return toOrgRow(row);
}

export async function findOrganizationById(id: string): Promise<OrganizationRow | null> {
  const row = await prisma.organization.findUnique({ where: { id } });
  return row ? toOrgRow(row) : null;
}

export async function findOrganizationBySlug(slug: string): Promise<OrganizationRow | null> {
  const row = await prisma.organization.findUnique({ where: { slug: slug.toLowerCase() } });
  return row ? toOrgRow(row) : null;
}

export async function listOrganizationsForUser(userId: string): Promise<OrganizationRow[]> {
  const rows = await prisma.organization.findMany({
    where: {
      OR: [
        { memberships: { some: { userId, status: { in: ["active", "pending"] } } } },
        {
          roleBindings: {
            some: {
              userId,
              role: { key: { in: ["employee", "org_admin"] } },
            },
          },
        },
      ],
    },
    orderBy: { name: "asc" },
  });
  return rows.map(toOrgRow);
}

/** Promote pending memberships once a staff role is already bound to the organization. */
export async function activatePendingStaffMemberships(userId: string): Promise<void> {
  const bindings = await prisma.roleBinding.findMany({
    where: {
      userId,
      organizationId: { not: null },
      role: { key: { in: ["employee", "org_admin"] } },
    },
    select: { organizationId: true },
  });
  const orgIds = [
    ...new Set(
      bindings
        .map((binding) => binding.organizationId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  if (!orgIds.length) return;
  await prisma.membership.updateMany({
    where: { userId, organizationId: { in: orgIds }, status: "pending" },
    data: { status: "active" },
  });
}

export async function searchDiscoverableOrganizations(
  userId: string,
  query: string,
  limit = 30,
): Promise<
  Array<
    OrganizationRow & {
      membershipStatus: string | null;
      joinRequestStatus: string | null;
    }
  >
> {
  const raw = query.trim().replace(/^\/+/, "").trim();
  const q = raw.toLowerCase();
  const slugCandidate = q.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

  const rows = await prisma.organization.findMany({
    where: {
      status: "active",
      ...(q
        ? {
            OR: [
              { name: { contains: raw, mode: "insensitive" as const } },
              { slug: { contains: slugCandidate || raw, mode: "insensitive" as const } },
              ...(slugCandidate
                ? [{ slug: { equals: slugCandidate, mode: "insensitive" as const } }]
                : []),
            ],
          }
        : {}),
    },
    include: {
      memberships: {
        where: { userId },
        select: { status: true },
        take: 1,
      },
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  const orgIds = rows.map((row) => row.id);
  const pendingRequests =
    orgIds.length === 0
      ? []
      : await prisma.membershipRequest.findMany({
          where: { userId, organizationId: { in: orgIds }, status: "pending" },
          select: { organizationId: true, status: true },
        });
  const pendingByOrg = new Map(pendingRequests.map((r) => [r.organizationId, r.status]));

  return rows.map((row) => ({
    ...toOrgRow(row),
    membershipStatus: row.memberships[0]?.status ?? null,
    joinRequestStatus: pendingByOrg.get(row.id) ?? null,
  }));
}

export async function updateOrganization(
  id: string,
  input: { name?: string; status?: string; parentOrganizationId?: string | null },
): Promise<OrganizationRow | null> {
  try {
    const row = await prisma.organization.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.parentOrganizationId !== undefined
          ? { parentOrganizationId: input.parentOrganizationId }
          : {}),
      },
    });
    return toOrgRow(row);
  } catch {
    return null;
  }
}

export function toPublicOrganization(org: OrganizationRow) {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    parentOrganizationId: org.parent_organization_id,
    status: org.status,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}
