import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./region.repository.js";

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

async function assertOrgAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) throw new AppError(403, "FORBIDDEN", "Organization admin role required");
}

export async function listRegions(
  _actorId: string,
  query: {
    status?: string;
    organizationId?: string;
    limit: number;
    offset: number;
  },
) {
  // Region catalog is readable by any authenticated caller (router already requires auth).
  // Org-scoped callers may still pass organizationId for future filtering hooks.
  void query.organizationId;
  return repo.listRegions(query);
}

export async function createRegion(
  actorId: string,
  body: {
    code: string;
    name: string;
    jurisdiction: string;
    endpointUrl: string;
    status?: string;
    priority?: number;
    latencyWeight?: number;
    metadata?: Record<string, unknown> | null;
    organizationId?: string;
    residency?: {
      mode?: string;
      allowedRegions?: string[];
      lockedClasses?: string[];
    };
  },
) {
  await assertSuperAdmin(actorId);
  if (body.organizationId) await assertOrgAdmin(actorId, body.organizationId);
  const result = await repo.createRegion({ ...body, createdById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "region.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "platform_region",
    resourceId: result.region.id,
    meta: { code: result.region.code, jurisdiction: result.region.jurisdiction },
  }).catch(() => undefined);
  return result;
}

export async function patchRegion(
  actorId: string,
  id: string,
  body: {
    name?: string;
    jurisdiction?: string;
    endpointUrl?: string;
    status?: string;
    priority?: number;
    latencyWeight?: number;
    metadata?: Record<string, unknown> | null;
  },
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.getRegion(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Region not found");
  const result = await repo.patchRegion(id, body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "region.update",
    actorUserId: actorId,
    resourceType: "platform_region",
    resourceId: id,
    meta: { status: result.region.status, code: result.region.code },
  }).catch(() => undefined);
  return result;
}

export async function getRouting(
  actorId: string,
  query: {
    organizationId: string;
    clientRegionHint?: string;
    stickyRegion?: string;
    dataClass?: string;
  },
) {
  await assertOrgAdmin(actorId, query.organizationId);
  return repo.getRoutingDecision(query);
}

export async function triggerFailover(
  actorId: string,
  body: {
    organizationId: string;
    reason: string;
    force?: boolean;
    consecutivePrimaryFailures?: number;
    failoverPolicy?: {
      mode?: string;
      primaryRegionCode?: string;
      standbyRegions?: string[];
      healthFailThreshold?: number;
    };
  },
) {
  await assertOrgAdmin(actorId, body.organizationId);
  const result = await repo.runFailover({ ...body, triggeredById: actorId });
  if (result.failover) {
    await writeAuditEvent({
      source: AuditEventSources.platform,
      action: "region.failover",
      actorUserId: actorId,
      organizationId: body.organizationId,
      resourceType: "region_failover_event",
      resourceId: result.failover.id,
      meta: {
        from: result.failover.fromRegionCode,
        to: result.failover.toRegionCode,
      },
    }).catch(() => undefined);
  }
  return result;
}

export async function getResidency(actorId: string, organizationId: string) {
  await assertOrgAdmin(actorId, organizationId);
  return repo.getResidencyReport(organizationId);
}

export {
  selectRegion,
  enforceResidency,
} from "./region.routing.js";
export {
  selectFailoverTarget,
  validateReplicationTargets,
  evaluateReplicationHealth,
  buildResidencyReport,
} from "./region.replication.js";
