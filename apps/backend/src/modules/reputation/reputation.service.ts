import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./reputation.repository.js";

async function assertReputationAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function listReputation(
  actorId: string,
  query: {
    organizationId: string;
    subjectType?: string;
    status?: string;
    limit: number;
    offset: number;
  },
) {
  await assertReputationAdmin(actorId, query.organizationId);
  return repo.listReputation(query);
}

export async function scoreSubject(
  actorId: string,
  body: {
    organizationId: string;
    subjectType: string;
    subjectId: string;
    label?: string;
    signals?: Record<string, number>;
    fraudSignals?: Record<string, number>;
    reason?: string;
  },
) {
  await assertReputationAdmin(actorId, body.organizationId);
  const result = await repo.scoreSubject({ ...body, updatedById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "reputation.score",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "reputation_profile",
    resourceId: result.profile.id,
    meta: {
      subjectType: body.subjectType,
      overallScore: result.profile.overallScore,
      fraudScore: result.profile.fraudScore,
    },
  }).catch(() => undefined);
  return result;
}

export async function patchReputation(
  actorId: string,
  id: string,
  body: {
    label?: string | null;
    status?: string;
    manualAdjustment?: number;
    reason?: string;
  },
) {
  const organizationId = await repo.getProfileOrganizationId(id);
  if (!organizationId) throw new AppError(404, "NOT_FOUND", "Reputation profile not found");
  await assertReputationAdmin(actorId, organizationId);
  const result = await repo.patchReputation(id, { ...body, updatedById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "reputation.patch",
    actorUserId: actorId,
    organizationId,
    resourceType: "reputation_profile",
    resourceId: id,
    meta: { status: body.status, manualAdjustment: body.manualAdjustment },
  }).catch(() => undefined);
  return result;
}

export async function listHistory(
  actorId: string,
  query: {
    organizationId: string;
    profileId?: string;
    subjectType?: string;
    limit: number;
    offset: number;
  },
) {
  await assertReputationAdmin(actorId, query.organizationId);
  return repo.listHistory(query);
}

export async function listAlerts(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    limit: number;
    offset: number;
  },
) {
  await assertReputationAdmin(actorId, query.organizationId);
  return repo.listAlerts(query);
}

export async function getLeaderboard(
  actorId: string,
  query: { organizationId: string; subjectType?: string; limit: number },
) {
  await assertReputationAdmin(actorId, query.organizationId);
  return repo.getLeaderboard(query);
}

export {
  calculateTrustScore,
  calculateContributionScore,
  scoreReputation,
  calculateHistoricalTrend,
  buildLeaderboard,
} from "./reputation.scoring.js";
export {
  detectAnomaly,
  calculateFraudScore,
  assessFraud,
} from "./reputation.fraud.js";
