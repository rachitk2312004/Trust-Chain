import { prisma } from "@trustchain/database";

export type BranchRow = {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: Date;
  updated_at: Date;
};

function toBranchRow(row: {
  id: string;
  organizationId: string;
  name: string;
  code: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: Date;
  updatedAt: Date;
}): BranchRow {
  return {
    id: row.id,
    organization_id: row.organizationId,
    name: row.name,
    code: row.code,
    address_line1: row.addressLine1,
    address_line2: row.addressLine2,
    city: row.city,
    region: row.region,
    postal_code: row.postalCode,
    country: row.country,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export async function createBranch(input: {
  organizationId: string;
  name: string;
  code?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}): Promise<BranchRow> {
  const row = await prisma.branch.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      code: input.code ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      region: input.region ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
    },
  });
  return toBranchRow(row);
}

export async function listBranches(organizationId: string): Promise<BranchRow[]> {
  const rows = await prisma.branch.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
  });
  return rows.map(toBranchRow);
}

export async function updateBranch(
  organizationId: string,
  branchId: string,
  input: Partial<{
    name: string;
    code: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    region: string | null;
    postalCode: string | null;
    country: string | null;
  }>,
): Promise<BranchRow | null> {
  const result = await prisma.branch.updateMany({
    where: { id: branchId, organizationId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.code !== undefined ? { code: input.code } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.region !== undefined ? { region: input.region } : {}),
      ...(input.postalCode !== undefined ? { postalCode: input.postalCode } : {}),
      ...(input.country !== undefined ? { country: input.country } : {}),
    },
  });
  if (result.count === 0) return null;
  const row = await prisma.branch.findFirst({ where: { id: branchId, organizationId } });
  return row ? toBranchRow(row) : null;
}

export async function deleteBranch(organizationId: string, branchId: string): Promise<boolean> {
  const result = await prisma.branch.deleteMany({ where: { id: branchId, organizationId } });
  return result.count > 0;
}

export function toPublicBranch(row: BranchRow) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    code: row.code,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    country: row.country,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
