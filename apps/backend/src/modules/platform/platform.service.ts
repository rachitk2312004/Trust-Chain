import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./platform.repository.js";

async function assertPlatformAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Super admin role required");
  }
}

export async function getHealth(actorId: string) {
  await assertPlatformAdmin(actorId);
  return repo.getHealth();
}

export async function getReadiness(actorId: string) {
  await assertPlatformAdmin(actorId);
  const data = await repo.getReadiness(actorId);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "platform.readiness",
    actorUserId: actorId,
    organizationId: null,
    resourceType: "platform_readiness_report",
    resourceId: data.id,
    meta: { status: data.status, score: data.score },
  }).catch(() => undefined);
  return data;
}

export async function listConfiguration(actorId: string) {
  await assertPlatformAdmin(actorId);
  return repo.listConfiguration();
}

export async function patchConfiguration(
  actorId: string,
  body: {
    entries: Array<{
      key: string;
      value: Record<string, unknown>;
      description?: string | null;
    }>;
  },
) {
  await assertPlatformAdmin(actorId);
  const data = await repo.patchConfiguration(body.entries, actorId);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "platform.configuration.patch",
    actorUserId: actorId,
    organizationId: null,
    resourceType: "platform_configuration",
    resourceId: null,
    meta: { keys: body.entries.map((e) => e.key) },
  }).catch(() => undefined);
  return data;
}

export async function listFeatures(
  actorId: string,
  query: { organizationId?: string; limit?: number },
) {
  await assertPlatformAdmin(actorId);
  return repo.listFeatures(query);
}

export async function patchFeature(
  actorId: string,
  id: string,
  body: {
    status?: string;
    rolloutPercent?: number;
    killSwitch?: boolean;
    targeting?: Record<string, unknown> | null;
    experiments?: Record<string, unknown> | null;
  },
) {
  await assertPlatformAdmin(actorId);
  const data = await repo.patchFeature(id, body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "platform.feature.patch",
    actorUserId: actorId,
    organizationId: data.feature.organizationId,
    resourceType: "feature_flag",
    resourceId: id,
    meta: {
      key: data.feature.key,
      status: data.feature.status,
      killSwitch: data.feature.killSwitch,
    },
  }).catch(() => undefined);
  return data;
}

export async function getMetrics(actorId: string, opts?: { persist?: boolean }) {
  await assertPlatformAdmin(actorId);
  return repo.getMetrics(opts);
}

export {
  aggregateHealthStatus,
  validateDependencies,
  buildHealthReport,
} from "./platform.health.js";
export {
  evaluateFeature,
  evaluateReadiness,
  aggregateTraces,
  generateMetrics,
} from "./platform.readiness.js";
