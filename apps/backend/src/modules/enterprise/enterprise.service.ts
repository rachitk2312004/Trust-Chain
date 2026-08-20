import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./enterprise.repository.js";
import type { ScimUserResource } from "./enterprise.scim.js";

async function assertEnterpriseAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (ok) return;

  const { prisma } = await import("@trustchain/database");
  const delegate = await prisma.enterpriseDelegateAdmin.findFirst({
    where: {
      organizationId,
      delegateUserId: userId,
      status: "active",
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  });
  if (!delegate) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function getEnterprise(actorId: string, organizationId: string) {
  await assertEnterpriseAdmin(actorId, organizationId);
  return repo.getEnterpriseDashboard(organizationId);
}

export async function upsertSaml(
  actorId: string,
  body: {
    organizationId: string;
    entityId: string;
    acsUrl: string;
    idpEntityId: string;
    idpSsoUrl: string;
    idpCertificatePem: string;
    attributeMapping?: {
      email?: string;
      firstName?: string;
      lastName?: string;
      groups?: string;
      department?: string;
    } | null;
    status?: string;
    startAccessReview?: boolean;
  },
) {
  await assertEnterpriseAdmin(actorId, body.organizationId);
  const result = await repo.upsertSamlConfig({
    ...body,
    updatedById: actorId,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "enterprise.saml.upsert",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "enterprise_saml",
    resourceId: result.saml.id,
    meta: { status: result.saml.status, entityId: result.saml.entityId },
  }).catch(() => undefined);
  return result;
}

export async function upsertScim(
  actorId: string,
  body: {
    organizationId: string;
    baseUrl: string;
    status?: string;
    userMapping?: Record<string, string> | null;
    rotateToken?: boolean;
    provisionUser?: ScimUserResource;
  },
) {
  await assertEnterpriseAdmin(actorId, body.organizationId);
  const result = await repo.upsertScimConfig({
    ...body,
    updatedById: actorId,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "enterprise.scim.upsert",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "enterprise_scim",
    resourceId: result.scim.id,
    meta: {
      status: result.scim.status,
      provision: result.provision?.operation ?? null,
      tokenRotated: Boolean(result.bearerToken),
    },
  }).catch(() => undefined);
  return result;
}

export async function listRoles(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    limit: number;
    offset: number;
  },
) {
  await assertEnterpriseAdmin(actorId, query.organizationId);
  return repo.listRoles(query);
}

export async function createRole(
  actorId: string,
  body: {
    organizationId: string;
    key: string;
    name: string;
    description?: string | null;
    parentRoleId?: string | null;
    permissions?: string[];
    status?: string;
    abac?: {
      name: string;
      effect: string;
      rules: Array<{
        attribute: string;
        operator: "eq" | "neq" | "in" | "contains";
        value: string | string[];
      }>;
      resourceType?: string | null;
      priority?: number;
    };
    delegateUserId?: string;
    delegateScope?: string[];
  },
) {
  await assertEnterpriseAdmin(actorId, body.organizationId);
  const result = await repo.createRole({ ...body, createdById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "enterprise.role.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "enterprise_role",
    resourceId: result.role.id,
    meta: { key: result.role.key, parentRoleId: result.role.parentRoleId },
  }).catch(() => undefined);
  return result;
}

export async function patchRole(
  actorId: string,
  id: string,
  body: {
    name?: string;
    description?: string | null;
    parentRoleId?: string | null;
    permissions?: string[];
    status?: string;
    accessReviewItemId?: string;
    accessReviewDecision?: string;
    accessReviewNotes?: string | null;
  },
) {
  const existing = await repo.getRole(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Enterprise role not found");
  await assertEnterpriseAdmin(actorId, existing.organizationId);
  const result = await repo.patchRole(id, body);
  if (!result) throw new AppError(404, "NOT_FOUND", "Enterprise role not found");
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "enterprise.role.update",
    actorUserId: actorId,
    organizationId: existing.organizationId,
    resourceType: "enterprise_role",
    resourceId: id,
    meta: {
      status: result.role.status,
      reviewItem: result.reviewItem?.id ?? null,
    },
  }).catch(() => undefined);
  return result;
}

export {
  resolveInheritedPermissions,
  evaluateAbac,
  summarizeAccessReview,
  collectRoleAncestors,
} from "./enterprise.repository.js";
