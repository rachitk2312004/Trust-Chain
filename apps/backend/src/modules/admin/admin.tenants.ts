import {
  AdminAuditActions,
  DeveloperEventTypes,
  NotificationEventTypes,
  RoleKeys,
  TenantLifecycleEventTypes,
  TenantLifecycleStatuses,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { bindRoleToUser, bindStaffRoleToUser, revokeOrgScopedRoles } from "../auth/roles.repository.js";
import { createMembership } from "../organizations/memberships.repository.js";
import { findUserById, findUserByEmail } from "../auth/users.repository.js";
import { publishDeveloperEventSafe } from "../developer/developer.delivery.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";
import { writeAdminAudit } from "./admin.audit.js";
import * as repo from "./admin.tenants.repository.js";
import {
  defaultTenantQuotaLimits,
  enforceTenantQuota,
  parseTenantQuotaLimits,
  quotaUtilization,
  resolveLifecycleTransition,
  slugifyTenantName,
  type TenantQuotaLimits,
} from "./admin.tenants.workflow.js";

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

async function refreshQuotaUsage(organizationId: string, updatedById?: string | null) {
  const quota = await repo.ensureDefaultQuota(organizationId, null, updatedById);
  const usage = await repo.measureTenantUsage(organizationId);
  const limits = parseTenantQuotaLimits(quota.limitsJson);
  const updated = await repo.upsertTenantQuota({
    organizationId,
    limits,
    usage,
    updatedById: updatedById ?? quota.updatedById,
  });
  return repo.toPublicQuota(updated);
}

function tenantSummary(
  row: NonNullable<Awaited<ReturnType<typeof repo.listTenants>>>["items"][number],
) {
  const quota = row.tenantQuota ? repo.toPublicQuota(row.tenantQuota) : null;
  return {
    ...repo.toPublicTenant(row),
    counts: {
      users: row._count.memberships,
      organizations: row._count.children,
      documents: row._count.documents,
      certificates: row._count.certificates,
      signatures: row._count.signatures,
    },
    quotas: quota,
  };
}

export async function listTenants(
  actorId: string,
  query: { search?: string; status?: string; limit: number; offset: number },
) {
  await assertSuperAdmin(actorId);
  const result = await repo.listTenants(query);
  return {
    tenants: result.items.map(tenantSummary),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function getTenant(actorId: string, tenantId: string) {
  await assertSuperAdmin(actorId);
  const row = await repo.findTenantById(tenantId);
  if (!row) throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");

  const quota = await refreshQuotaUsage(tenantId, actorId);
  const events = await repo.listLifecycleEvents(tenantId, 50);

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.tenantInspect,
    targetType: "tenant",
    targetId: tenantId,
    organizationId: tenantId,
    meta: { slug: row.slug },
  });

  return {
    tenant: repo.toPublicTenant(row),
    parent: row.parent,
    children: row.children,
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
    quotas: {
      ...quota,
      utilization: quotaUtilization(quota.limits, quota.usage),
    },
    lifecycle: events.map(repo.toPublicLifecycleEvent),
  };
}

export async function createTenant(
  actorId: string,
  input: {
    name: string;
    slug?: string;
    ownerUserId?: string;
    ownerEmail?: string;
    parentOrganizationId?: string | null;
    quotas?: Partial<TenantQuotaLimits>;
  },
) {
  await assertSuperAdmin(actorId);

  let ownerUserId = input.ownerUserId;
  if (!ownerUserId && input.ownerEmail) {
    const ownerByEmail = await findUserByEmail(input.ownerEmail.trim().toLowerCase());
    if (!ownerByEmail) {
      throw new AppError(
        404,
        "USER_NOT_FOUND",
        "No user account exists for that organization admin email. Ask them to register first.",
      );
    }
    ownerUserId = ownerByEmail.id;
  }
  if (!ownerUserId) {
    throw new AppError(400, "OWNER_REQUIRED", "Organization admin is required");
  }
  if (ownerUserId === actorId) {
    throw new AppError(
      400,
      "INVALID_OWNER",
      "Platform administrators cannot assign themselves as organization admin.",
    );
  }

  const owner = await findUserById(ownerUserId);
  if (!owner) throw new AppError(404, "USER_NOT_FOUND", "Owner user not found");

  const slug = input.slug ? slugifyTenantName(input.slug) : slugifyTenantName(input.name);
  if (!slug) throw new AppError(400, "INVALID_SLUG", "Tenant slug is invalid");

  const existing = await repo.findTenantSlug(slug);
  if (existing) throw new AppError(409, "SLUG_IN_USE", "Tenant slug is already in use");

  if (input.parentOrganizationId) {
    const parent = await repo.findTenantById(input.parentOrganizationId);
    if (!parent) throw new AppError(404, "PARENT_NOT_FOUND", "Parent tenant not found");
    if (parent.status !== TenantLifecycleStatuses.active) {
      throw new AppError(409, "PARENT_NOT_ACTIVE", "Parent tenant must be active");
    }
    const parentQuota = await repo.ensureDefaultQuota(parent.id);
    const parentUsage = await repo.measureTenantUsage(parent.id);
    const check = enforceTenantQuota(
      parseTenantQuotaLimits(parentQuota.limitsJson),
      parentUsage,
      "organizations",
      1,
    );
    if (!check.ok) {
      throw new AppError(409, "QUOTA_EXCEEDED", check.reason);
    }
  }

  const limits = defaultTenantQuotaLimits(input.quotas);
  const org = await repo.createTenantRecord({
    name: input.name,
    slug,
    parentOrganizationId: input.parentOrganizationId,
    status: TenantLifecycleStatuses.active,
  });

  await createMembership({
    organizationId: org.id,
    userId: ownerUserId,
    status: "active",
  });
  await bindRoleToUser({
    userId: ownerUserId,
    roleKey: RoleKeys.orgAdmin,
    organizationId: org.id,
  });

  const usage = await repo.measureTenantUsage(org.id);
  const quota = await repo.upsertTenantQuota({
    organizationId: org.id,
    limits,
    usage,
    updatedById: actorId,
  });

  const event = await repo.createLifecycleEvent({
    organizationId: org.id,
    eventType: TenantLifecycleEventTypes.created,
    fromStatus: null,
    toStatus: TenantLifecycleStatuses.active,
    actorUserId: actorId,
    meta: { ownerUserId, slug },
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.tenantCreate,
    targetType: "tenant",
    targetId: org.id,
    organizationId: org.id,
    meta: { slug, ownerUserId },
  });

  await emitDomainNotification({
    organizationId: org.id,
    actorId,
    eventType: NotificationEventTypes.tenantCreated,
    entityId: org.id,
    entityType: "tenant",
    title: "Tenant created",
    message: `Tenant ${org.name} was created.`,
    metadata: { slug: org.slug },
    recipientUserIds: [ownerUserId, actorId],
  });

  if (input.parentOrganizationId) {
    await refreshQuotaUsage(input.parentOrganizationId, actorId);
  }

  return {
    tenant: repo.toPublicTenant(org),
    quotas: repo.toPublicQuota(quota),
    lifecycleEvent: repo.toPublicLifecycleEvent(event),
  };
}

export async function patchTenant(
  actorId: string,
  tenantId: string,
  input: {
    name?: string;
    status?: string;
    parentOrganizationId?: string | null;
    quotas?: Partial<TenantQuotaLimits>;
  },
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findTenantById(tenantId);
  if (!existing) throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");

  if (input.parentOrganizationId) {
    if (input.parentOrganizationId === tenantId) {
      throw new AppError(400, "INVALID_PARENT", "Tenant cannot be its own parent");
    }
    const parent = await repo.findTenantById(input.parentOrganizationId);
    if (!parent) throw new AppError(404, "PARENT_NOT_FOUND", "Parent tenant not found");
  }

  const updated = await repo.updateTenantRecord(tenantId, {
    name: input.name,
    status: input.status,
    parentOrganizationId: input.parentOrganizationId,
  });

  let quota = existing.tenantQuota
    ? repo.toPublicQuota(existing.tenantQuota)
    : await refreshQuotaUsage(tenantId, actorId);

  if (input.quotas) {
    const nextLimits = defaultTenantQuotaLimits({
      ...quota.limits,
      ...input.quotas,
    });
    const usage = await repo.measureTenantUsage(tenantId);
    const saved = await repo.upsertTenantQuota({
      organizationId: tenantId,
      limits: nextLimits,
      usage,
      updatedById: actorId,
    });
    quota = repo.toPublicQuota(saved);
    await repo.createLifecycleEvent({
      organizationId: tenantId,
      eventType: TenantLifecycleEventTypes.quotaUpdated,
      actorUserId: actorId,
      meta: { limits: nextLimits },
    });
  }

  if (input.name || input.status || input.parentOrganizationId !== undefined) {
    await repo.createLifecycleEvent({
      organizationId: tenantId,
      eventType: TenantLifecycleEventTypes.updated,
      fromStatus: existing.status,
      toStatus: updated.status,
      actorUserId: actorId,
      meta: {
        name: input.name,
        parentOrganizationId: input.parentOrganizationId,
      },
    });
  }

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.tenantUpdate,
    targetType: "tenant",
    targetId: tenantId,
    organizationId: tenantId,
    meta: input,
  });

  publishDeveloperEventSafe({
    organizationId: tenantId,
    eventType: DeveloperEventTypes.tenantUpdated,
    data: {
      tenantId,
      name: updated.name,
      status: updated.status,
      changes: input,
    },
  });

  return { tenant: repo.toPublicTenant(updated), quotas: quota };
}

async function transitionTenant(
  actorId: string,
  tenantId: string,
  action: "suspend" | "restore" | "archive",
  reason?: string,
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findTenantById(tenantId);
  if (!existing) throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");

  const transition = resolveLifecycleTransition(action, existing.status);
  if (!transition.ok) {
    throw new AppError(409, "INVALID_LIFECYCLE_TRANSITION", transition.reason);
  }

  const updated = await repo.updateTenantRecord(tenantId, { status: transition.toStatus });
  const eventType =
    action === "suspend"
      ? TenantLifecycleEventTypes.suspended
      : action === "restore"
        ? TenantLifecycleEventTypes.restored
        : TenantLifecycleEventTypes.archived;

  const event = await repo.createLifecycleEvent({
    organizationId: tenantId,
    eventType,
    fromStatus: transition.fromStatus,
    toStatus: transition.toStatus,
    actorUserId: actorId,
    meta: { reason: reason ?? null },
  });

  const auditAction =
    action === "suspend"
      ? AdminAuditActions.tenantSuspend
      : action === "restore"
        ? AdminAuditActions.tenantRestore
        : AdminAuditActions.tenantArchive;

  await writeAdminAudit({
    actorUserId: actorId,
    action: auditAction,
    targetType: "tenant",
    targetId: tenantId,
    organizationId: tenantId,
    meta: { fromStatus: transition.fromStatus, toStatus: transition.toStatus, reason },
  });

  const notificationType =
    action === "suspend"
      ? NotificationEventTypes.tenantSuspended
      : action === "restore"
        ? NotificationEventTypes.tenantRestored
        : NotificationEventTypes.tenantArchived;

  await emitDomainNotification({
    organizationId: tenantId,
    actorId,
    eventType: notificationType,
    entityId: tenantId,
    entityType: "tenant",
    title: `Tenant ${action}d`,
    message: `Tenant ${existing.name} was ${action}d.`,
    metadata: { reason: reason ?? null, status: transition.toStatus },
  });

  return {
    tenant: repo.toPublicTenant(updated),
    lifecycleEvent: repo.toPublicLifecycleEvent(event),
  };
}

export async function suspendTenant(actorId: string, tenantId: string, reason?: string) {
  return transitionTenant(actorId, tenantId, "suspend", reason);
}

export async function restoreTenant(actorId: string, tenantId: string, reason?: string) {
  return transitionTenant(actorId, tenantId, "restore", reason);
}

export async function archiveTenant(actorId: string, tenantId: string, reason?: string) {
  return transitionTenant(actorId, tenantId, "archive", reason);
}

export async function transferTenant(
  actorId: string,
  tenantId: string,
  input: { toUserId: string; toParentOrganizationId?: string | null; reason?: string },
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.findTenantById(tenantId);
  if (!existing) throw new AppError(404, "TENANT_NOT_FOUND", "Tenant not found");

  if (existing.status === TenantLifecycleStatuses.archived) {
    throw new AppError(409, "TENANT_ARCHIVED", "Cannot reassign ownership of an archived tenant");
  }

  const targetUser = await findUserById(input.toUserId);
  if (!targetUser) throw new AppError(404, "USER_NOT_FOUND", "Transfer target user not found");

  if (input.toParentOrganizationId) {
    if (input.toParentOrganizationId === tenantId) {
      throw new AppError(400, "INVALID_PARENT", "Tenant cannot be its own parent");
    }
    const parent = await repo.findTenantById(input.toParentOrganizationId);
    if (!parent) throw new AppError(404, "PARENT_NOT_FOUND", "Parent tenant not found");
  }

  const previousAdmins = existing.roleBindings
    .filter((b) => b.role.key === RoleKeys.orgAdmin)
    .map((b) => b.userId)
    .filter((userId) => userId !== input.toUserId);

  for (const adminId of previousAdmins) {
    await revokeOrgScopedRoles(adminId, tenantId, [RoleKeys.orgAdmin]);
  }

  await createMembership({
    organizationId: tenantId,
    userId: input.toUserId,
    status: "active",
  });

  await bindStaffRoleToUser({
    userId: input.toUserId,
    roleKey: RoleKeys.orgAdmin,
    organizationId: tenantId,
  });

  const updated =
    input.toParentOrganizationId !== undefined
      ? await repo.updateTenantRecord(tenantId, {
          parentOrganizationId: input.toParentOrganizationId,
        })
      : existing;

  const event = await repo.createLifecycleEvent({
    organizationId: tenantId,
    eventType: TenantLifecycleEventTypes.transferred,
    fromStatus: existing.status,
    toStatus: existing.status,
    actorUserId: actorId,
    meta: {
      toUserId: input.toUserId,
      fromUserIds: previousAdmins,
      toParentOrganizationId: input.toParentOrganizationId ?? null,
      reason: input.reason ?? null,
      ownershipOnly: true,
    },
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.tenantTransfer,
    targetType: "tenant",
    targetId: tenantId,
    organizationId: tenantId,
    meta: {
      toUserId: input.toUserId,
      toParentOrganizationId: input.toParentOrganizationId ?? null,
      reason: input.reason ?? null,
    },
  });

  await emitDomainNotification({
    organizationId: tenantId,
    actorId,
    eventType: NotificationEventTypes.tenantTransferred,
    entityId: tenantId,
    entityType: "tenant",
    title: "Tenant ownership assigned",
    message: `${existing.name} organization admin access was assigned.`,
    metadata: { toUserId: input.toUserId },
    recipientUserIds: [input.toUserId, ...previousAdmins, actorId],
  });

  return {
    tenant: repo.toPublicTenant(updated),
    lifecycleEvent: repo.toPublicLifecycleEvent(event),
    transferredToUserId: input.toUserId,
  };
}

/** Pure helper used by other modules / tests — refresh and enforce a resource. */
export async function checkTenantQuota(
  organizationId: string,
  resource: keyof TenantQuotaLimits,
  delta = 1,
) {
  const quota = await repo.ensureDefaultQuota(organizationId);
  const usage = await repo.measureTenantUsage(organizationId);
  return enforceTenantQuota(parseTenantQuotaLimits(quota.limitsJson), usage, resource, delta);
}
