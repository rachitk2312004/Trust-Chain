import { prisma } from "@trustchain/database";

export type BrandingRow = {
  organization_id: string;
  display_name: string | null;
  logo_object_key: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  updated_at: Date;
};

function toBrandingRow(row: {
  organizationId: string;
  displayName: string | null;
  logoObjectKey: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  updatedAt: Date;
}): BrandingRow {
  return {
    organization_id: row.organizationId,
    display_name: row.displayName,
    logo_object_key: row.logoObjectKey,
    primary_color: row.primaryColor,
    secondary_color: row.secondaryColor,
    updated_at: row.updatedAt,
  };
}

export async function getBranding(organizationId: string): Promise<BrandingRow | null> {
  const row = await prisma.organizationBranding.findUnique({ where: { organizationId } });
  return row ? toBrandingRow(row) : null;
}

export async function upsertBranding(input: {
  organizationId: string;
  displayName?: string | null;
  logoObjectKey?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}): Promise<BrandingRow> {
  const row = await prisma.organizationBranding.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      displayName: input.displayName ?? null,
      logoObjectKey: input.logoObjectKey ?? null,
      primaryColor: input.primaryColor ?? null,
      secondaryColor: input.secondaryColor ?? null,
    },
    update: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.logoObjectKey !== undefined ? { logoObjectKey: input.logoObjectKey } : {}),
      ...(input.primaryColor !== undefined ? { primaryColor: input.primaryColor } : {}),
      ...(input.secondaryColor !== undefined ? { secondaryColor: input.secondaryColor } : {}),
    },
  });
  return toBrandingRow(row);
}

export function toPublicBranding(row: BrandingRow) {
  return {
    organizationId: row.organization_id,
    displayName: row.display_name,
    logoObjectKey: row.logo_object_key,
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    updatedAt: row.updated_at,
  };
}
