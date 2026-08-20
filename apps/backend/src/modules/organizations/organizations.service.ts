import { RoleKeys } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { bindStaffRoleToUser } from "../auth/roles.repository.js";
import {
  userHasRole,
  userHasRoleFromBindings,
  type RoleBindingView,
} from "../auth/rbac.repository.js";
import { findUserById } from "../auth/users.repository.js";
import { createMembership } from "./memberships.repository.js";
import {
  createOrganization,
  findOrganizationById,
  findOrganizationBySlug,
  listOrganizationsForUser,
  toPublicOrganization,
  updateOrganization,
} from "./organizations.repository.js";
import { listMyJoinRequests } from "./joinRequests.service.js";

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
  input: { name: string; slug?: string; parentOrganizationId?: string; ownerUserId?: string },
) {
  const isSuperAdmin = await userHasRole(userId, [RoleKeys.superAdmin]);

  if (!input.parentOrganizationId) {
    if (!isSuperAdmin) {
      throw new AppError(
        403,
        "FORBIDDEN",
        "Only platform administrators can create organizations",
      );
    }
    if (!input.ownerUserId) {
      throw new AppError(
        400,
        "OWNER_REQUIRED",
        "Assign an organization admin when provisioning a tenant (use Admin → Tenants).",
      );
    }
    if (input.ownerUserId === userId) {
      throw new AppError(
        400,
        "INVALID_OWNER",
        "Platform administrators cannot assign themselves as organization admin.",
      );
    }
    const owner = await findUserById(input.ownerUserId);
    if (!owner) {
      throw new AppError(404, "USER_NOT_FOUND", "Organization admin user not found");
    }
  }

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

  const adminUserId = input.parentOrganizationId ? userId : input.ownerUserId!;
  await createMembership({
    organizationId: org.id,
    userId: adminUserId,
    status: "active",
  });
  await bindStaffRoleToUser({
    userId: adminUserId,
    roleKey: RoleKeys.orgAdmin,
    organizationId: org.id,
  });

  return toPublicOrganization(org);
}

export async function getOrganizationForUser(_userId: string, organizationId: string) {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");
  }
  if (org.status === "suspended") {
    throw new AppError(
      403,
      "ORG_SUSPENDED",
      "This organization has been suspended by a platform administrator.",
    );
  }
  if (org.status === "deleted" || org.status === "disabled") {
    throw new AppError(403, "ORG_UNAVAILABLE", "This organization is not available.");
  }

  return toPublicOrganization(org);
}

export async function getOrganizationOverviewForUser(
  organizationId: string,
  roleBindings: RoleBindingView[],
) {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    throw new AppError(404, "ORG_NOT_FOUND", "Organization not found");
  }
  if (org.status === "suspended") {
    throw new AppError(
      403,
      "ORG_SUSPENDED",
      "This organization has been suspended by a platform administrator.",
    );
  }
  if (org.status === "deleted" || org.status === "disabled") {
    throw new AppError(403, "ORG_UNAVAILABLE", "This organization is not available.");
  }

  const canManageMembers = userHasRoleFromBindings(
    roleBindings,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );

  const [memberCount, branchCount, departmentCount, pendingJoinCount] = await Promise.all([
    prisma.membership.count({ where: { organizationId } }),
    prisma.branch.count({ where: { organizationId } }),
    prisma.department.count({ where: { organizationId } }),
    canManageMembers
      ? prisma.membershipRequest.count({
          where: { organizationId, status: "pending" },
        })
      : Promise.resolve(0),
  ]);

  return {
    organization: toPublicOrganization(org),
    stats: {
      memberCount,
      branchCount,
      departmentCount,
      pendingJoinCount,
    },
  };
}

export async function listUserOrganizations(userId: string) {
  const orgs = await listOrganizationsForUser(userId);
  return orgs.map(toPublicOrganization);
}

/** One HTTP round trip for top-bar org switcher (memberships + join requests). */
export async function getOrganizationWorkspaceContext(userId: string) {
  const [organizations, joinRequests] = await Promise.all([
    listUserOrganizations(userId),
    listMyJoinRequests(userId),
  ]);
  return { organizations, joinRequests };
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
