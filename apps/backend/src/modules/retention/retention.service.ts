import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./retention.repository.js";

async function assertRetentionAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function listPolicies(
  actorId: string,
  query: {
    organizationId: string;
    targetType?: string;
    status?: string;
    limit: number;
    offset: number;
  },
) {
  await assertRetentionAdmin(actorId, query.organizationId);
  return repo.listPolicies(query);
}

export async function createPolicy(
  actorId: string,
  body: {
    organizationId: string;
    name: string;
    description?: string | null;
    targetType: string;
    retentionDays: number;
    disposition: string;
    status?: string;
    priority?: number;
  },
) {
  await assertRetentionAdmin(actorId, body.organizationId);
  const policy = await repo.createPolicy({ ...body, createdById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "retention.policy.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "retention_policy",
    resourceId: policy.id,
    meta: { targetType: policy.targetType, disposition: policy.disposition },
  }).catch(() => undefined);
  return { policy };
}

export async function patchPolicy(
  actorId: string,
  id: string,
  body: {
    name?: string;
    description?: string | null;
    retentionDays?: number;
    disposition?: string;
    status?: string;
    priority?: number;
  },
) {
  const existing = await repo.getPolicy(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Retention policy not found");
  await assertRetentionAdmin(actorId, existing.organizationId);
  const policy = await repo.patchPolicy(id, body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "retention.policy.update",
    actorUserId: actorId,
    organizationId: existing.organizationId,
    resourceType: "retention_policy",
    resourceId: id,
    meta: { status: policy.status },
  }).catch(() => undefined);
  return { policy };
}

export async function listHolds(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    limit: number;
    offset: number;
  },
) {
  await assertRetentionAdmin(actorId, query.organizationId);
  return repo.listHolds(query);
}

export async function createHold(
  actorId: string,
  body: {
    organizationId: string;
    name: string;
    reason: string;
    scope: string;
    targetType?: string | null;
    targetIds?: string[];
    startsAt?: string;
    endsAt?: string | null;
  },
) {
  await assertRetentionAdmin(actorId, body.organizationId);
  const hold = await repo.createHold({
    organizationId: body.organizationId,
    name: body.name,
    reason: body.reason,
    scope: body.scope,
    targetType: body.targetType,
    targetIds: body.targetIds,
    startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
    endsAt: body.endsAt ? new Date(body.endsAt) : body.endsAt === null ? null : undefined,
    createdById: actorId,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "retention.hold.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "legal_hold",
    resourceId: hold.id,
    meta: { scope: hold.scope, targetType: hold.targetType },
  }).catch(() => undefined);
  return { hold };
}

export async function patchHold(
  actorId: string,
  id: string,
  body: {
    name?: string;
    reason?: string;
    status?: string;
    endsAt?: string | null;
    targetIds?: string[];
  },
) {
  const existing = await repo.getHold(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Legal hold not found");
  await assertRetentionAdmin(actorId, existing.organizationId);
  const hold = await repo.patchHold(id, {
    name: body.name,
    reason: body.reason,
    status: body.status,
    endsAt:
      body.endsAt === undefined
        ? undefined
        : body.endsAt === null
          ? null
          : new Date(body.endsAt),
    targetIds: body.targetIds,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "retention.hold.update",
    actorUserId: actorId,
    organizationId: existing.organizationId,
    resourceType: "legal_hold",
    resourceId: id,
    meta: { status: hold.status },
  }).catch(() => undefined);
  return { hold };
}

export async function runRetention(
  actorId: string,
  body: {
    organizationId: string;
    dryRun?: boolean;
    targetType?: string;
    limit?: number;
  },
) {
  await assertRetentionAdmin(actorId, body.organizationId);
  const result = await repo.runRetentionForOrganization({
    organizationId: body.organizationId,
    dryRun: body.dryRun ?? false,
    targetType: body.targetType,
    limit: body.limit ?? 200,
    actorUserId: actorId,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "retention.run",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "retention_run",
    resourceId: result.run.id,
    meta: {
      dryRun: result.run.dryRun,
      summary: result.run.summary,
    },
  }).catch(() => undefined);
  return result;
}

export async function getStatus(actorId: string, organizationId: string) {
  await assertRetentionAdmin(actorId, organizationId);
  return repo.getRetentionStatus(organizationId);
}
