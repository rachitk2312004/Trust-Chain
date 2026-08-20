import {
  AdminAuditActions,
  RoleKeys,
  SystemConfigKeys,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { rolesForDisplay } from "../../lib/roleDisplay.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { toPublicAudit, writeAdminAudit } from "./admin.audit.js";
import {
  ADMIN_PERMISSION_CATALOG,
  DEFAULT_ROLE_CAPABILITIES,
  mergeRoleCapabilityOverrides,
  normalizeCapabilities,
  parseRoleCapabilityMatrix,
  type RoleCapabilityMatrix,
} from "./admin.permissions.js";
import * as repo from "./admin.repository.js";

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

function toAdminUserSummary(row: Awaited<ReturnType<typeof repo.listUsers>>["items"][number]) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    status: row.status,
    emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    roles: rolesForDisplay(
      row.roleBindings.map((b) => ({
        roleKey: b.role.key,
        roleName: b.role.name,
        organizationId: b.organizationId,
      })),
    ),
    memberships: row.memberships.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      organizationName: m.organization.name,
      organizationSlug: m.organization.slug,
      status: m.status,
      title: m.title,
    })),
  };
}

export async function listAdminUsers(
  actorId: string,
  query: { search?: string; status?: string; limit: number; offset: number },
) {
  await assertSuperAdmin(actorId);
  const result = await repo.listUsers(query);
  return {
    users: result.items.map(toAdminUserSummary),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function inspectAdminUser(actorId: string, userId: string) {
  await assertSuperAdmin(actorId);
  const row = await repo.findUserInspection(userId);
  if (!row) throw new AppError(404, "USER_NOT_FOUND", "User not found");

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.userInspect,
    targetType: "user",
    targetId: userId,
    meta: { email: row.email },
  });

  return {
    user: {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      status: row.status,
      emailVerifiedAt: row.emailVerifiedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    roles: rolesForDisplay(
      row.roleBindings.map((b) => ({
        id: b.id,
        roleKey: b.role.key,
        roleName: b.role.name,
        organizationId: b.organizationId,
        organizationName: b.organization?.name ?? null,
        organizationSlug: b.organization?.slug ?? null,
        createdAt: b.createdAt.toISOString(),
      })),
    ),
    memberships: row.memberships.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      organization: m.organization,
      branch: m.branch,
      department: m.department,
      title: m.title,
      status: m.status,
      createdAt: m.createdAt.toISOString(),
    })),
  };
}

export async function listAdminOrganizations(
  actorId: string,
  query: { search?: string; status?: string; limit: number; offset: number },
) {
  await assertSuperAdmin(actorId);
  const result = await repo.listOrganizations(query);
  return {
    organizations: result.items.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      parentOrganizationId: org.parentOrganizationId,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
      counts: {
        memberships: org._count.memberships,
        roleBindings: org._count.roleBindings,
        documents: org._count.documents,
      },
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function inspectAdminOrganization(actorId: string, organizationId: string) {
  await assertSuperAdmin(actorId);
  const row = await repo.findOrganizationInspection(organizationId);
  if (!row) throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.organizationInspect,
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    meta: { slug: row.slug, name: row.name },
  });

  return {
    organization: {
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      parentOrganizationId: row.parentOrganizationId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    counts: row._count,
    memberships: row.memberships.map((m) => ({
      id: m.id,
      status: m.status,
      title: m.title,
      user: m.user,
    })),
    roleBindings: row.roleBindings.map((b) => ({
      id: b.id,
      roleKey: b.role.key,
      roleName: b.role.name,
      user: b.user,
      createdAt: b.createdAt.toISOString(),
    })),
  };
}

export async function listAdminRoles(actorId: string) {
  await assertSuperAdmin(actorId);
  const roles = await repo.listRoles();
  return {
    roles: roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      bindingCount: role._count.roleBindings,
      createdAt: role.createdAt.toISOString(),
    })),
  };
}

async function loadRoleCapabilityMatrix(): Promise<RoleCapabilityMatrix> {
  const row = await repo.getConfigurationByKey(SystemConfigKeys.roleCapabilities);
  const overrides = row ? parseRoleCapabilityMatrix(row.valueJson) : null;
  return mergeRoleCapabilityOverrides(DEFAULT_ROLE_CAPABILITIES, overrides);
}

export async function listAdminPermissions(actorId: string) {
  await assertSuperAdmin(actorId);
  const matrix = await loadRoleCapabilityMatrix();
  return {
    catalog: ADMIN_PERMISSION_CATALOG,
    roleCapabilities: matrix,
    defaults: DEFAULT_ROLE_CAPABILITIES,
  };
}

export async function assignRolePermissions(
  actorId: string,
  input: { roleKey: string; capabilities: string[] },
) {
  await assertSuperAdmin(actorId);
  const role = await repo.findRoleByKey(input.roleKey);
  if (!role) throw new AppError(404, "ROLE_NOT_FOUND", "Role not found");

  const matrix = await loadRoleCapabilityMatrix();
  const next: RoleCapabilityMatrix = {
    ...matrix,
    [input.roleKey]: normalizeCapabilities(input.capabilities),
  };

  const config = await repo.upsertConfiguration({
    key: SystemConfigKeys.roleCapabilities,
    value: next,
    description: "Role capability grants for administration platform",
    updatedById: actorId,
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.permissionAssign,
    targetType: "role",
    targetId: role.id,
    meta: { roleKey: input.roleKey, capabilities: next[input.roleKey] },
  });

  return {
    roleKey: input.roleKey,
    capabilities: next[input.roleKey],
    roleCapabilities: next,
    configuration: repo.toPublicConfiguration(config),
  };
}

export async function assignAdminRole(
  actorId: string,
  input: { userId: string; roleKey: string; organizationId?: string | null },
) {
  await assertSuperAdmin(actorId);
  const user = await repo.findUserInspection(input.userId);
  if (!user) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  const role = await repo.findRoleByKey(input.roleKey);
  if (!role) throw new AppError(404, "ROLE_NOT_FOUND", "Role not found");

  if (input.roleKey === RoleKeys.superAdmin && input.organizationId) {
    throw new AppError(400, "INVALID_ROLE_SCOPE", "super_admin cannot be scoped to an organization");
  }
  if (
    (input.roleKey === RoleKeys.orgAdmin || input.roleKey === RoleKeys.employee) &&
    !input.organizationId
  ) {
    throw new AppError(
      400,
      "INVALID_ROLE_SCOPE",
      `${input.roleKey} requires an organizationId`,
    );
  }

  const result = await repo.createRoleBinding({
    userId: input.userId,
    roleId: role.id,
    organizationId: input.organizationId ?? null,
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.roleAssign,
    targetType: "user",
    targetId: input.userId,
    organizationId: input.organizationId ?? null,
    meta: {
      roleKey: input.roleKey,
      created: result.created,
      bindingId: result.binding.id,
    },
  });

  return {
    created: result.created,
    binding: {
      id: result.binding.id,
      userId: result.binding.userId,
      roleKey: role.key,
      roleName: role.name,
      organizationId: result.binding.organizationId,
      createdAt: result.binding.createdAt.toISOString(),
    },
  };
}

export async function revokeAdminRole(
  actorId: string,
  input: { userId: string; roleKey: string; organizationId?: string | null },
) {
  await assertSuperAdmin(actorId);
  const role = await repo.findRoleByKey(input.roleKey);
  if (!role) throw new AppError(404, "ROLE_NOT_FOUND", "Role not found");

  const result = await repo.deleteRoleBinding({
    userId: input.userId,
    roleId: role.id,
    organizationId: input.organizationId ?? null,
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.roleRevoke,
    targetType: "user",
    targetId: input.userId,
    organizationId: input.organizationId ?? null,
    success: result.deleted,
    meta: { roleKey: input.roleKey, deleted: result.deleted },
  });

  return { deleted: result.deleted };
}

export async function getAdminConfiguration(actorId: string) {
  await assertSuperAdmin(actorId);
  const rows = await repo.listConfigurations();
  const roleCapabilities = await loadRoleCapabilityMatrix();
  return {
    configurations: rows.map(repo.toPublicConfiguration),
    roleCapabilities,
    knownKeys: Object.values(SystemConfigKeys),
  };
}

export async function updateAdminConfiguration(
  actorId: string,
  input: { key: string; value: unknown; description?: string | null },
) {
  const { updateConfigurationWithHistory } = await import("./admin.configuration.js");
  return updateConfigurationWithHistory(actorId, input);
}

export async function listAdminAuditLogs(
  actorId: string,
  query: {
    action?: string;
    actorUserId?: string;
    targetType?: string;
    success?: boolean;
    from?: string;
    to?: string;
    q?: string;
    limit: number;
    offset: number;
  },
) {
  await assertSuperAdmin(actorId);
  const result = await repo.listAuditLogs({
    action: query.action,
    actorUserId: query.actorUserId,
    targetType: query.targetType,
    success: query.success,
    from: query.from ? new Date(query.from) : undefined,
    to: query.to ? new Date(query.to) : undefined,
    limit: query.q ? Math.min(query.limit * 5, 500) : query.limit,
    offset: query.q ? 0 : query.offset,
  });

  let events = result.items.map(toPublicAudit);
  if (query.q) {
    const { filterAuditEvents } = await import("./admin.audit.js");
    events = filterAuditEvents(events, { q: query.q });
    const total = events.length;
    events = events.slice(query.offset, query.offset + query.limit);
    return {
      events,
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }

  return {
    events,
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function listAdminFeatureFlags(actorId: string, organizationId?: string) {
  await assertSuperAdmin(actorId);
  const rows = await repo.listFeatureFlags({ organizationId });
  return { featureFlags: rows.map(repo.toPublicFeature) };
}

export async function createAdminFeatureFlag(
  actorId: string,
  input: {
    organizationId?: string | null;
    key: string;
    status?: string;
    rolloutPercent?: number;
    killSwitch?: boolean;
    targeting?: Record<string, unknown> | null;
    experiments?: Record<string, unknown> | null;
  },
) {
  await assertSuperAdmin(actorId);
  const row = await repo.createFeatureFlag(input);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.featureFlagCreate,
    targetType: "feature_flag",
    targetId: row.id,
    organizationId: row.organizationId,
    meta: { key: row.key, publicCode: row.publicCode },
  });
  return { featureFlag: repo.toPublicFeature(row) };
}

export async function updateAdminFeatureFlag(
  actorId: string,
  featureFlagId: string,
  input: {
    status?: string;
    rolloutPercent?: number;
    killSwitch?: boolean;
    targeting?: Record<string, unknown> | null;
    experiments?: Record<string, unknown> | null;
  },
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findFeatureFlagById(featureFlagId);
  if (!existing) throw new AppError(404, "FEATURE_FLAG_NOT_FOUND", "Feature flag not found");

  const row = await repo.updateFeatureFlag(featureFlagId, input);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.featureFlagUpdate,
    targetType: "feature_flag",
    targetId: row.id,
    organizationId: row.organizationId,
    meta: {
      key: row.key,
      status: row.status,
      killSwitch: row.killSwitch,
      rolloutPercent: row.rolloutPercent,
    },
  });
  return { featureFlag: repo.toPublicFeature(row) };
}

async function assertManageableUser(actorId: string, userId: string) {
  if (actorId === userId) {
    throw new AppError(400, "INVALID_TARGET", "You cannot modify your own account this way");
  }
  const isTargetSuperAdmin = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (isTargetSuperAdmin) {
    throw new AppError(403, "FORBIDDEN", "Super admin accounts cannot be suspended or modified");
  }
}

function adminStatusMessage(
  entity: "user" | "organization",
  action: "suspend" | "restore" | "delete",
  reason?: string | null,
): string {
  if (reason?.trim()) return reason.trim();
  if (entity === "user") {
    if (action === "suspend") return "This account has been suspended by a platform administrator.";
    if (action === "restore") return "This account has been restored by a platform administrator.";
  }
  if (entity === "organization") {
    if (action === "suspend") return "This organization has been suspended by a platform administrator.";
    if (action === "restore") return "This organization has been restored by a platform administrator.";
    if (action === "delete") return "This organization has been deleted by a platform administrator.";
  }
  return "Updated by platform administrator.";
}

export async function patchAdminUser(
  actorId: string,
  userId: string,
  input: { firstName?: string | null; lastName?: string | null },
) {
  await assertSuperAdmin(actorId);
  await assertManageableUser(actorId, userId);
  const existing = await repo.findUserInspection(userId);
  if (!existing) throw new AppError(404, "USER_NOT_FOUND", "User not found");

  await repo.updateUserAdminRecord(userId, input);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.userUpdate,
    targetType: "user",
    targetId: userId,
    meta: { email: existing.email, ...input },
  });

  const row = await repo.findUserInspection(userId);
  if (!row) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return { user: toAdminUserSummary(row) };
}

export async function suspendAdminUser(
  actorId: string,
  userId: string,
  reason?: string | null,
) {
  await assertSuperAdmin(actorId);
  await assertManageableUser(actorId, userId);
  const existing = await repo.findUserInspection(userId);
  if (!existing) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  if (existing.status === "disabled") {
    return {
      user: toAdminUserSummary(existing),
      message: adminStatusMessage("user", "suspend", reason),
    };
  }

  await repo.updateUserAdminRecord(userId, { status: "disabled" });
  const message = adminStatusMessage("user", "suspend", reason);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.userSuspend,
    targetType: "user",
    targetId: userId,
    meta: { email: existing.email, reason: reason ?? null, message },
  });

  const row = await repo.findUserInspection(userId);
  if (!row) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return { user: toAdminUserSummary(row), message };
}

export async function restoreAdminUser(
  actorId: string,
  userId: string,
  reason?: string | null,
) {
  await assertSuperAdmin(actorId);
  await assertManageableUser(actorId, userId);
  const existing = await repo.findUserInspection(userId);
  if (!existing) throw new AppError(404, "USER_NOT_FOUND", "User not found");

  await repo.updateUserAdminRecord(userId, { status: "active" });
  const message = adminStatusMessage("user", "restore", reason);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.userRestore,
    targetType: "user",
    targetId: userId,
    meta: { email: existing.email, reason: reason ?? null, message },
  });

  const row = await repo.findUserInspection(userId);
  if (!row) throw new AppError(404, "USER_NOT_FOUND", "User not found");
  return { user: toAdminUserSummary(row), message };
}

export async function patchAdminOrganization(
  actorId: string,
  organizationId: string,
  input: { name?: string; slug?: string },
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findOrganizationInspection(organizationId);
  if (!existing) throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  if (existing.status === "deleted") {
    throw new AppError(400, "ORGANIZATION_DELETED", "Deleted organizations cannot be edited");
  }

  if (input.slug && input.slug !== existing.slug) {
    const taken = await prisma.organization.findFirst({
      where: { slug: input.slug, NOT: { id: organizationId } },
    });
    if (taken) throw new AppError(409, "SLUG_IN_USE", "Organization slug is already in use");
  }

  const updated = await repo.updateOrganizationRecord(organizationId, input);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.organizationUpdate,
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    meta: { slug: updated.slug, name: updated.name, ...input },
  });

  return {
    organization: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      parentOrganizationId: updated.parentOrganizationId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  };
}

export async function suspendAdminOrganization(
  actorId: string,
  organizationId: string,
  reason?: string | null,
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findOrganizationInspection(organizationId);
  if (!existing) throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  if (existing.status === "deleted") {
    throw new AppError(400, "ORGANIZATION_DELETED", "Organization is already deleted");
  }

  const updated = await repo.updateOrganizationRecord(organizationId, { status: "suspended" });
  const message = adminStatusMessage("organization", "suspend", reason);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.organizationSuspend,
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    meta: { slug: existing.slug, reason: reason ?? null, message },
  });

  return {
    organization: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      parentOrganizationId: updated.parentOrganizationId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    message,
  };
}

export async function restoreAdminOrganization(
  actorId: string,
  organizationId: string,
  reason?: string | null,
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findOrganizationInspection(organizationId);
  if (!existing) throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  if (existing.status === "deleted") {
    throw new AppError(400, "ORGANIZATION_DELETED", "Deleted organizations cannot be restored");
  }

  const updated = await repo.updateOrganizationRecord(organizationId, { status: "active" });
  const message = adminStatusMessage("organization", "restore", reason);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.organizationRestore,
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    meta: { slug: existing.slug, reason: reason ?? null, message },
  });

  return {
    organization: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      parentOrganizationId: updated.parentOrganizationId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    message,
  };
}

export async function deleteAdminOrganization(
  actorId: string,
  organizationId: string,
  reason?: string | null,
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findOrganizationInspection(organizationId);
  if (!existing) throw new AppError(404, "ORGANIZATION_NOT_FOUND", "Organization not found");
  if (existing.status === "deleted") {
    return {
      organization: {
        id: existing.id,
        name: existing.name,
        slug: existing.slug,
        status: existing.status,
        parentOrganizationId: existing.parentOrganizationId,
        createdAt: existing.createdAt.toISOString(),
        updatedAt: existing.updatedAt.toISOString(),
      },
      message: adminStatusMessage("organization", "delete", reason),
    };
  }

  const updated = await repo.updateOrganizationRecord(organizationId, { status: "deleted" });
  const message = adminStatusMessage("organization", "delete", reason);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.organizationDelete,
    targetType: "organization",
    targetId: organizationId,
    organizationId,
    meta: { slug: existing.slug, reason: reason ?? null, message },
  });

  return {
    organization: {
      id: updated.id,
      name: updated.name,
      slug: updated.slug,
      status: updated.status,
      parentOrganizationId: updated.parentOrganizationId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
    message,
  };
}

export async function getAdminDashboard(actorId: string) {
  await assertSuperAdmin(actorId);
  const [users, organizations, roles, featureFlags, audits] = await Promise.all([
    repo.listUsers({ limit: 1, offset: 0 }),
    repo.listOrganizations({ limit: 1, offset: 0 }),
    repo.listRoles(),
    repo.listFeatureFlags(),
    repo.listAuditLogs({ limit: 10, offset: 0 }),
  ]);
  return {
    summary: {
      users: users.total,
      organizations: organizations.total,
      roles: roles.length,
      featureFlags: featureFlags.length,
      recentAuditEvents: audits.total,
    },
    recentAudit: audits.items.map(toPublicAudit),
  };
}
