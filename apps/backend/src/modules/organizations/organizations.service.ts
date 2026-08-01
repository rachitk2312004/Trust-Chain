import { RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { bindRoleToUser } from "../auth/roles.repository.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { createMembership } from "./memberships.repository.js";
import {
  createOrganization,
  findOrganizationById,
  findOrganizationBySlug,
  listOrganizationsForUser,
  toPublicOrganization,
  updateOrganization,
} from "./organizations.repository.js";

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export async function createOrganizationForUser(
  userId: string,
  input: { name: string; slug?: string; parentOrganizationId?: string },
) {
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  if (!slug) {
    throw new AppError(400, "INVALID_SLUG", "Organization slug is invalid");
  }

  const existing = await findOrganizationBySlug(slug);
  if (existing) {
    throw new AppError(409, "SLUG_IN_USE", "Organization slug is already in use");
  }

  if (input.parentOrganizationId) {
    const parent = await findOrganizationById(input.parentOrganizationId);
    if (!parent) {
      throw new AppError(404, "PARENT_NOT_FOUND", "Parent organization not found");
    }
    const allowed = await userHasRole(
      userId,
      [RoleKeys.superAdmin, RoleKeys.orgAdmin],
      input.parentOrganizationId,
    );
    if (!allowed) {
      throw new AppError(403, "FORBIDDEN", "Cannot create child under this organization");
    }
  }

  const org = await createOrganization({
    name: input.name,
    slug,
    parentOrganizationId: input.parentOrganizationId,
  });

  await createMembership({
    organizationId: org.id,
    userId,
    status: "active",
  });
  await bindRoleToUser({
    userId,
    roleKey: RoleKeys.orgAdmin,
    organizationId: org.id,
  });

  return toPublicOrganization(org);
}

export async function getOrganizationForUser(userId: string, organizationId: string) {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");
  }

  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Not a member of this organization");
  }

  return toPublicOrganization(org);
}

export async function listUserOrganizations(userId: string) {
  const orgs = await listOrganizationsForUser(userId);
  return orgs.map(toPublicOrganization);
}

export async function patchOrganizationForUser(
  userId: string,
  organizationId: string,
  input: { name?: string; status?: "active" | "disabled"; parentOrganizationId?: string | null },
) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
  }

  const updated = await updateOrganization(organizationId, input);
  if (!updated) {
    throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");
  }
  return toPublicOrganization(updated);
}
