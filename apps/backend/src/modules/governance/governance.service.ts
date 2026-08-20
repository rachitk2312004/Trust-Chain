import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./governance.repository.js";

async function assertGovernanceAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function getGovernance(actorId: string, organizationId: string) {
  await assertGovernanceAdmin(actorId, organizationId);
  return repo.getGovernanceDashboard(organizationId);
}

export async function createPolicy(
  actorId: string,
  body: {
    organizationId: string;
    framework: string;
    key: string;
    title: string;
    description?: string;
    status?: string;
    ownerUserId?: string | null;
  },
) {
  await assertGovernanceAdmin(actorId, body.organizationId);
  const result = await repo.createPolicy({ ...body, createdById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "governance.policy.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "governance_policy",
    resourceId: result.policy.id,
    meta: { key: body.key, framework: body.framework },
  }).catch(() => undefined);
  return result;
}

export async function patchPolicy(
  actorId: string,
  id: string,
  body: {
    title?: string;
    description?: string | null;
    status?: string;
    ownerUserId?: string | null;
    framework?: string;
  },
) {
  const organizationId = await repo.getPolicyOrganizationId(id);
  if (!organizationId) throw new AppError(404, "NOT_FOUND", "Policy not found");
  await assertGovernanceAdmin(actorId, organizationId);
  const result = await repo.patchPolicy(id, body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "governance.policy.patch",
    actorUserId: actorId,
    organizationId,
    resourceType: "governance_policy",
    resourceId: id,
    meta: { status: body.status },
  }).catch(() => undefined);
  return result;
}

export async function listRisks(
  actorId: string,
  query: {
    organizationId: string;
    status?: string;
    framework?: string;
    limit: number;
    offset: number;
  },
) {
  await assertGovernanceAdmin(actorId, query.organizationId);
  return repo.listRisks(query);
}

export async function createRisk(
  actorId: string,
  body: {
    organizationId: string;
    key: string;
    title: string;
    description?: string;
    category: string;
    framework?: string | null;
    likelihood: number;
    impact: number;
    residualLikelihood?: number;
    residualImpact?: number;
    mitigationEffectiveness?: number;
    status?: string;
    ownerUserId?: string | null;
    controlKeys?: string[];
  },
) {
  await assertGovernanceAdmin(actorId, body.organizationId);
  const result = await repo.createRisk({ ...body, createdById: actorId });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "governance.risk.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "governance_risk",
    resourceId: result.risk.id,
    meta: {
      key: body.key,
      residualScore: result.risk.residualScore,
      band: result.risk.band,
    },
  }).catch(() => undefined);
  return result;
}

export async function patchRisk(
  actorId: string,
  id: string,
  body: {
    title?: string;
    description?: string | null;
    category?: string;
    framework?: string | null;
    likelihood?: number;
    impact?: number;
    residualLikelihood?: number;
    residualImpact?: number;
    mitigationEffectiveness?: number;
    status?: string;
    ownerUserId?: string | null;
    controlKeys?: string[];
  },
) {
  const organizationId = await repo.getRiskOrganizationId(id);
  if (!organizationId) throw new AppError(404, "NOT_FOUND", "Risk not found");
  await assertGovernanceAdmin(actorId, organizationId);
  const result = await repo.patchRisk(id, body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "governance.risk.patch",
    actorUserId: actorId,
    organizationId,
    resourceType: "governance_risk",
    resourceId: id,
    meta: { residualScore: result.risk.residualScore, status: body.status },
  }).catch(() => undefined);
  return result;
}

export async function listReports(
  actorId: string,
  query: { organizationId: string; limit: number; offset: number },
) {
  await assertGovernanceAdmin(actorId, query.organizationId);
  return repo.listGovernanceReports(query);
}

export {
  calculateInherentRiskScore,
  calculateResidualRiskScore,
  aggregateRiskPortfolio,
  validateOwnership,
  riskBand,
} from "./governance.risk.js";
export {
  evaluateControl,
  evaluateControlCatalog,
  runAssessmentWorkflow,
  buildAssessmentWorkflow,
  buildExecutiveSummary,
  listControlsForFramework,
  GovernanceControlCatalog,
  GovernanceFrameworkCatalog,
} from "./governance.controls.js";
