import { RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { createUploadUrl } from "../../integrations/objectStorage.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { getBranding, toPublicBranding, upsertBranding } from "./branding.repository.js";

async function assertOrgAdmin(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function getOrgBranding(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization membership required");
  }
  const branding = await getBranding(organizationId);
  return branding ? toPublicBranding(branding) : null;
}

export async function updateOrgBranding(
  userId: string,
  organizationId: string,
  input: {
    displayName?: string;
    primaryColor?: string;
    secondaryColor?: string;
    logoObjectKey?: string;
  },
) {
  await assertOrgAdmin(userId, organizationId);
  const branding = await upsertBranding({
    organizationId,
    displayName: input.displayName,
    primaryColor: input.primaryColor,
    secondaryColor: input.secondaryColor,
    logoObjectKey: input.logoObjectKey,
  });
  return toPublicBranding(branding);
}

export async function createLogoUploadUrl(
  userId: string,
  organizationId: string,
  contentType: string,
) {
  await assertOrgAdmin(userId, organizationId);
  const extension = contentType.split("/")[1] ?? "bin";
  const objectKey = `orgs/${organizationId}/branding/logo-${Date.now()}.${extension}`;
  return createUploadUrl({ objectKey, contentType });
}
