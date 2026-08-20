import { AuditEventSources, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAuditEvent } from "../audit/audit.service.js";
import * as repo from "./organization.repository.js";
import type { ApprovalStepInput } from "./organization.approvals.js";
import type { PolicyMap } from "./organization.hierarchy.js";

async function assertOrgPlatformAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function getOrganization(actorId: string, organizationId: string) {
  await assertOrgPlatformAdmin(actorId, organizationId);
  return repo.getOrganizationPlatform(organizationId);
}

export async function createDepartment(
  actorId: string,
  body: {
    organizationId: string;
    name: string;
    code?: string | null;
    branchId?: string | null;
    parentDepartmentId?: string | null;
    businessUnitId?: string | null;
    costCenterId?: string | null;
    ownerUserId?: string | null;
    policy?: PolicyMap;
    status?: string;
  },
) {
  await assertOrgPlatformAdmin(actorId, body.organizationId);
  const result = await repo.createDepartment(body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "organization.department.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "department",
    resourceId: result.department.id,
    meta: { name: result.department.name },
  }).catch(() => undefined);
  return result;
}

export async function patchDepartment(
  actorId: string,
  id: string,
  body: {
    name?: string;
    code?: string | null;
    branchId?: string | null;
    parentDepartmentId?: string | null;
    businessUnitId?: string | null;
    costCenterId?: string | null;
    ownerUserId?: string | null;
    policy?: PolicyMap;
    status?: string;
  },
) {
  const existing = await repo.getDepartment(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Department not found");
  await assertOrgPlatformAdmin(actorId, existing.organizationId);
  const result = await repo.patchDepartment(id, body);
  if (!result) throw new AppError(404, "NOT_FOUND", "Department not found");
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "organization.department.update",
    actorUserId: actorId,
    organizationId: existing.organizationId,
    resourceType: "department",
    resourceId: id,
    meta: { status: result.department.status },
  }).catch(() => undefined);
  return result;
}

export async function createBusinessUnit(
  actorId: string,
  body: {
    organizationId: string;
    key: string;
    name: string;
    description?: string | null;
    parentUnitId?: string | null;
    ownerUserId?: string | null;
    policy?: PolicyMap;
    status?: string;
    costCenter?: { code: string; name: string; allocationPct?: number };
  },
) {
  await assertOrgPlatformAdmin(actorId, body.organizationId);
  const result = await repo.createBusinessUnit(body);
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "organization.business_unit.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "business_unit",
    resourceId: result.businessUnit.id,
    meta: { key: result.businessUnit.key },
  }).catch(() => undefined);
  return result;
}

export async function patchBusinessUnit(
  actorId: string,
  id: string,
  body: {
    name?: string;
    description?: string | null;
    parentUnitId?: string | null;
    ownerUserId?: string | null;
    policy?: PolicyMap;
    status?: string;
  },
) {
  const existing = await repo.getBusinessUnit(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Business unit not found");
  await assertOrgPlatformAdmin(actorId, existing.organizationId);
  const result = await repo.patchBusinessUnit(id, body);
  if (!result) throw new AppError(404, "NOT_FOUND", "Business unit not found");
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "organization.business_unit.update",
    actorUserId: actorId,
    organizationId: existing.organizationId,
    resourceType: "business_unit",
    resourceId: id,
    meta: { status: result.businessUnit.status },
  }).catch(() => undefined);
  return result;
}

export async function getHierarchy(actorId: string, organizationId: string) {
  await assertOrgPlatformAdmin(actorId, organizationId);
  return repo.getHierarchy(organizationId);
}

export async function createApproval(
  actorId: string,
  body: {
    organizationId: string;
    name: string;
    resourceType: string;
    status?: string;
    steps: ApprovalStepInput[];
    resourceOwnerUserId?: string | null;
  },
) {
  await assertOrgPlatformAdmin(actorId, body.organizationId);
  const result = await repo.createApprovalWorkflow({
    ...body,
    createdById: actorId,
    actorUserId: actorId,
  });
  await writeAuditEvent({
    source: AuditEventSources.platform,
    action: "organization.approval.create",
    actorUserId: actorId,
    organizationId: body.organizationId,
    resourceType: "org_approval_workflow",
    resourceId: result.workflow.id,
    meta: { resourceType: body.resourceType, steps: body.steps.length },
  }).catch(() => undefined);
  return result;
}

export {
  buildTree,
  resolveInheritedPolicy,
  validateOwnership,
  buildOrgReport,
  detectHierarchyCycle,
} from "./organization.hierarchy.js";
export {
  validateApprovalSteps,
  resolveApprovalChain,
  evaluateApprovalProgress,
} from "./organization.approvals.js";
