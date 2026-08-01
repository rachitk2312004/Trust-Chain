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
      memberships: {
        some: { userId, status: "active" },
      },
    },
    orderBy: { name: "asc" },
  });
  return rows.map(toOrgRow);
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
