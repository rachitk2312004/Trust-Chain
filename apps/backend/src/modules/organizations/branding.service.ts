import { RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { createUploadUrl, putObjectBuffer } from "../../integrations/objectStorage.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { assertOrgFeature } from "../billing/billing.entitlements.js";
import { BillingFeatureKeys } from "../billing/billing.plans.js";
import { normalizeLogoUpload } from "../certificates/certificates.logo.js";
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

/** Logo is needed for issued certificates — allow Premium Pro (issue) or Max Pro branding. */
async function assertLogoEntitlement(userId: string, organizationId: string): Promise<void> {
  try {
    await assertOrgFeature(userId, organizationId, BillingFeatureKeys.customBranding);
  } catch {
    await assertOrgFeature(userId, organizationId, BillingFeatureKeys.issueCertificates);
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
  await assertLogoEntitlement(userId, organizationId);
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
  await assertLogoEntitlement(userId, organizationId);
  const extension = contentType.split("/")[1]?.replace("+xml", "") ?? "bin";
  const objectKey = `orgs/${organizationId}/branding/logo-${Date.now()}.${extension}`;
  return createUploadUrl({ objectKey, contentType });
}

/**
 * Direct logo upload through the API into B2/R2 (or local disk fallback).
 * Normalizes to PNG so certificate PDF/PNG embed always works.
 */
export async function uploadOrgLogo(
  userId: string,
  organizationId: string,
  input: { contentType: string; fileBase64: string },
) {
  await assertOrgAdmin(userId, organizationId);
  await assertLogoEntitlement(userId, organizationId);

  const raw = Buffer.from(input.fileBase64, "base64");
  if (!raw.length || raw.length > 8_000_000) {
    throw new AppError(400, "LOGO_TOO_LARGE", "Logo must be under 8 MiB.");
  }

  let png: Buffer;
  try {
    png = await normalizeLogoUpload(raw);
  } catch {
    throw new AppError(400, "LOGO_INVALID", "Could not read logo. Use PNG, JPEG, WebP, or SVG.");
  }

  const objectKey = `orgs/${organizationId}/branding/logo-${Date.now()}.png`;
  await putObjectBuffer({
    objectKey,
    body: png,
    contentType: "image/png",
  });

  const branding = await upsertBranding({
    organizationId,
    logoObjectKey: objectKey,
  });
  return toPublicBranding(branding);
}
