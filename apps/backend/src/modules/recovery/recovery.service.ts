import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./recovery.repository.js";

async function assertRecoveryAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function getRecovery(actorId: string, organizationId: string) {
  await assertRecoveryAdmin(actorId, organizationId);
  return repo.getRecoveryDashboard(organizationId);
}

export async function createBackup(
  actorId: string,
  body: {
    organizationId: string;
    policy?: {
      name: string;
      frequency: string;
      rpoMinutes: number;
      rtoMinutes: number;
      retentionDays: number;
      regionCode: string;
      scopes?: string[];
      enabled?: boolean;
    };
    policyId?: string;
  },
) {
  await assertRecoveryAdmin(actorId, body.organizationId);
  const result = await repo.createBackup({ ...body, triggeredById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "recovery.backup.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "recovery_backup_job",
    resourceId: result.backup.id,
    meta: { policyId: result.policy.id, region: result.backup.regionCode },
  }).catch(() => undefined);
  return result;
}

export async function createRestore(
  actorId: string,
  body: {
    organizationId: string;
    backupJobId: string;
    targetRegionCode: string;
  },
) {
  await assertRecoveryAdmin(actorId, body.organizationId);
  const result = await repo.createRestore({ ...body, triggeredById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "recovery.restore.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "recovery_restore_job",
    resourceId: result.restore.id,
    meta: {
      backupJobId: body.backupJobId,
      targetRegion: body.targetRegionCode,
      rto: result.restore.achievedRtoMinutes,
    },
  }).catch(() => undefined);
  return result;
}

export async function createFailback(
  actorId: string,
  body: {
    organizationId: string;
    fromRegionCode: string;
    toRegionCode: string;
    reason: string;
  },
) {
  await assertRecoveryAdmin(actorId, body.organizationId);
  const result = await repo.createFailback({ ...body, triggeredById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "recovery.failback.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "recovery_failback_job",
    resourceId: result.failback.id,
    meta: {
      from: body.fromRegionCode,
      to: body.toRegionCode,
    },
  }).catch(() => undefined);
  return result;
}

export async function getStatus(actorId: string, organizationId: string) {
  await assertRecoveryAdmin(actorId, organizationId);
  return repo.getRecoveryStatus(organizationId);
}

export async function listReports(
  actorId: string,
  query: { organizationId: string; limit: number; offset: number },
) {
  await assertRecoveryAdmin(actorId, query.organizationId);
  return repo.listRecoveryReports(query);
}

export {
  calculateAchievedRpoMinutes,
  isRpoWithinTarget,
  createBackupRecord,
  shouldScheduleBackup,
} from "./recovery.backup.js";
export {
  validateRestoreCandidate,
  buildFailbackPlan,
  executeFailbackSteps,
  calculateContinuityScore,
  calculateAchievedRtoMinutes,
} from "./recovery.restore.js";
