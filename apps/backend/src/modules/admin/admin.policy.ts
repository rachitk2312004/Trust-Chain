import {
  AdminAuditActions,
  NotificationEventTypes,
  RoleKeys,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";
import { writeAdminAudit } from "./admin.audit.js";
import {
  evaluatePolicies,
  type EvaluationContext,
  type PolicyAssignmentLike,
  type PolicyDefinitionLike,
} from "./admin.policy.engine.js";
import * as repo from "./admin.policy.repository.js";

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

function toDefinitionLike(row: {
  id: string;
  name: string;
  policyType: string;
  status: string;
  priority: number;
  parentPolicyId: string | null;
  rulesJson: unknown;
}): PolicyDefinitionLike {
  const rules =
    row.rulesJson && typeof row.rulesJson === "object" && !Array.isArray(row.rulesJson)
      ? (row.rulesJson as Record<string, unknown>)
      : {};
  return {
    id: row.id,
    name: row.name,
    policyType: row.policyType,
    status: row.status,
    priority: row.priority,
    parentPolicyId: row.parentPolicyId,
    rules,
  };
}

function toAssignmentLike(row: {
  id: string;
  policyId: string;
  organizationId: string;
  inheritToChildren: boolean;
  enabled: boolean;
}): PolicyAssignmentLike {
  return {
    id: row.id,
    policyId: row.policyId,
    organizationId: row.organizationId,
    inheritToChildren: row.inheritToChildren,
    enabled: row.enabled,
  };
}

async function assertParentPolicy(parentPolicyId: string | null | undefined) {
  if (!parentPolicyId) return;
  const parent = await repo.getPolicyDefinition(parentPolicyId);
  if (!parent) {
    throw new AppError(404, "NOT_FOUND", "Parent policy not found");
  }
}

export async function listPolicies(
  actorId: string,
  query: {
    policyType?: string;
    status?: string;
    organizationId?: string;
    search?: string;
    limit: number;
    offset: number;
  },
) {
  await assertSuperAdmin(actorId);
  return repo.listPolicyDefinitions(query);
}

export async function getPolicy(actorId: string, policyId: string) {
  await assertSuperAdmin(actorId);
  const row = await repo.getPolicyDefinition(policyId);
  if (!row) throw new AppError(404, "NOT_FOUND", "Policy not found");

  const evaluations = await repo.listRecentEvaluations(policyId, 25);
  const { policies, assignments } = await repo.listAllActivePoliciesAndAssignments(
    row.policyType,
  );
  const conflicts = evaluatePolicies({
    policies: policies.map(toDefinitionLike),
    assignments: assignments.map(toAssignmentLike),
    organizationId: row.assignments[0]?.organizationId ?? null,
    ancestorOrganizationIds: [],
    policyType: row.policyType,
    context: {},
    includeGlobal: true,
  }).conflicts.filter(
    (c) => c.leftPolicyId === policyId || c.rightPolicyId === policyId,
  );

  return {
    policy: repo.toPublicPolicy(row, row.assignments),
    evaluations: evaluations.map(repo.toPublicEvaluation),
    conflicts,
  };
}

export async function createPolicy(
  actorId: string,
  input: {
    name: string;
    description?: string | null;
    policyType: string;
    status: string;
    priority: number;
    parentPolicyId?: string | null;
    rules: Record<string, unknown>;
    assignments?: Array<{
      organizationId: string;
      inheritToChildren: boolean;
      enabled: boolean;
    }>;
  },
) {
  await assertSuperAdmin(actorId);
  await assertParentPolicy(input.parentPolicyId);

  const row = await repo.createPolicyDefinition({
    name: input.name,
    description: input.description,
    policyType: input.policyType,
    status: input.status,
    priority: input.priority,
    parentPolicyId: input.parentPolicyId,
    rules: input.rules,
    createdById: actorId,
  });

  let assignments = row.assignments;
  if (input.assignments && input.assignments.length > 0) {
    assignments = await repo.replacePolicyAssignments(
      row.id,
      input.assignments,
      actorId,
    );
  }

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.policyCreate,
    targetType: "policy",
    targetId: row.id,
    organizationId: assignments[0]?.organizationId ?? null,
    meta: {
      publicCode: row.publicCode,
      policyType: row.policyType,
      status: row.status,
      assignmentCount: assignments.length,
    },
  });

  const orgId = assignments[0]?.organizationId;
  if (orgId) {
    await emitDomainNotification({
      organizationId: orgId,
      actorId,
      eventType: NotificationEventTypes.policyCreated,
      entityId: row.id,
      entityType: "policy",
      title: "Policy created",
      message: `Policy ${row.name} (${row.policyType}) was created.`,
      metadata: { publicCode: row.publicCode, policyType: row.policyType },
    });
  }

  if (assignments.length > 0) {
    await writeAdminAudit({
      actorUserId: actorId,
      action: AdminAuditActions.policyAssign,
      targetType: "policy",
      targetId: row.id,
      organizationId: assignments[0]?.organizationId ?? null,
      meta: {
        assignments: assignments.map((a) => ({
          organizationId: a.organizationId,
          inheritToChildren: a.inheritToChildren,
          enabled: a.enabled,
        })),
      },
    });
    for (const assignment of assignments) {
      await emitDomainNotification({
        organizationId: assignment.organizationId,
        actorId,
        eventType: NotificationEventTypes.policyAssigned,
        entityId: row.id,
        entityType: "policy",
        title: "Policy assigned",
        message: `Policy ${row.name} was assigned to this organization.`,
        metadata: {
          policyId: row.id,
          inheritToChildren: assignment.inheritToChildren,
        },
      });
    }
  }

  return { policy: repo.toPublicPolicy(row, assignments) };
}

export async function patchPolicy(
  actorId: string,
  policyId: string,
  input: {
    name?: string;
    description?: string | null;
    status?: string;
    priority?: number;
    parentPolicyId?: string | null;
    rules?: Record<string, unknown>;
    assignments?: Array<{
      organizationId: string;
      inheritToChildren: boolean;
      enabled: boolean;
    }>;
  },
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.getPolicyDefinition(policyId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Policy not found");
  if (input.parentPolicyId === policyId) {
    throw new AppError(400, "VALIDATION_ERROR", "Policy cannot be its own parent");
  }
  await assertParentPolicy(input.parentPolicyId);

  const row = await repo.updatePolicyDefinition(policyId, {
    name: input.name,
    description: input.description,
    status: input.status,
    priority: input.priority,
    parentPolicyId: input.parentPolicyId,
    rules: input.rules,
  });

  let assignments = row.assignments;
  if (input.assignments) {
    assignments = await repo.replacePolicyAssignments(
      policyId,
      input.assignments,
      actorId,
    );
    await writeAdminAudit({
      actorUserId: actorId,
      action: AdminAuditActions.policyAssign,
      targetType: "policy",
      targetId: policyId,
      organizationId: assignments[0]?.organizationId ?? null,
      meta: {
        assignments: assignments.map((a) => ({
          organizationId: a.organizationId,
          inheritToChildren: a.inheritToChildren,
          enabled: a.enabled,
        })),
      },
    });
    for (const assignment of assignments) {
      await emitDomainNotification({
        organizationId: assignment.organizationId,
        actorId,
        eventType: NotificationEventTypes.policyAssigned,
        entityId: policyId,
        entityType: "policy",
        title: "Policy assigned",
        message: `Policy ${row.name} was assigned to this organization.`,
        metadata: {
          policyId,
          inheritToChildren: assignment.inheritToChildren,
        },
      });
    }
  }

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.policyUpdate,
    targetType: "policy",
    targetId: policyId,
    organizationId: assignments[0]?.organizationId ?? null,
    meta: {
      publicCode: row.publicCode,
      changes: Object.keys(input).filter((k) => k !== "assignments"),
      status: row.status,
    },
  });

  const notifyOrg = assignments[0]?.organizationId;
  if (notifyOrg) {
    await emitDomainNotification({
      organizationId: notifyOrg,
      actorId,
      eventType: NotificationEventTypes.policyUpdated,
      entityId: policyId,
      entityType: "policy",
      title: "Policy updated",
      message: `Policy ${row.name} was updated.`,
      metadata: { publicCode: row.publicCode, status: row.status },
    });
  }

  return { policy: repo.toPublicPolicy(row, assignments) };
}

export async function deletePolicy(actorId: string, policyId: string) {
  await assertSuperAdmin(actorId);
  const existing = await repo.getPolicyDefinition(policyId);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Policy not found");

  const orgId = existing.assignments[0]?.organizationId ?? null;
  await repo.deletePolicyDefinition(policyId);

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.policyDelete,
    targetType: "policy",
    targetId: policyId,
    organizationId: orgId,
    meta: {
      publicCode: existing.publicCode,
      policyType: existing.policyType,
      name: existing.name,
    },
  });

  if (orgId) {
    await emitDomainNotification({
      organizationId: orgId,
      actorId,
      eventType: NotificationEventTypes.policyDeleted,
      entityId: policyId,
      entityType: "policy",
      title: "Policy deleted",
      message: `Policy ${existing.name} was deleted.`,
      metadata: { publicCode: existing.publicCode },
    });
  }

  return { deleted: true, policyId };
}

export async function evaluateAdminPolicies(
  actorId: string,
  input: {
    organizationId?: string | null;
    policyType?: string;
    includeGlobal?: boolean;
    context: EvaluationContext;
  },
) {
  await assertSuperAdmin(actorId);

  const organizationId = input.organizationId ?? null;
  const ancestorOrganizationIds = organizationId
    ? await repo.getOrganizationAncestorIds(organizationId)
    : [];

  const { policies, assignments } = await repo.listAllActivePoliciesAndAssignments(
    input.policyType,
  );

  const result = evaluatePolicies({
    policies: policies.map(toDefinitionLike),
    assignments: assignments.map(toAssignmentLike),
    organizationId,
    ancestorOrganizationIds,
    policyType: input.policyType,
    context: input.context,
    includeGlobal: input.includeGlobal,
  });

  const event = await repo.createPolicyEvaluationEvent({
    policyId: result.matchedPolicyIds[0] ?? null,
    organizationId,
    actorUserId: actorId,
    policyType: result.policyType,
    decision: result.decision,
    context: input.context,
    result,
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.policyEvaluate,
    targetType: "policy",
    targetId: result.matchedPolicyIds[0] ?? null,
    organizationId,
    success: result.decision !== "conflict",
    meta: {
      decision: result.decision,
      policyType: result.policyType,
      matchedPolicyIds: result.matchedPolicyIds,
      conflictCount: result.conflicts.length,
    },
  });

  if (organizationId) {
    const eventType =
      result.decision === "conflict"
        ? NotificationEventTypes.policyConflict
        : NotificationEventTypes.policyEvaluated;
    await emitDomainNotification({
      organizationId,
      actorId,
      eventType,
      entityId: result.matchedPolicyIds[0] ?? organizationId,
      entityType: "policy",
      title:
        result.decision === "conflict"
          ? "Policy conflict detected"
          : "Policy evaluated",
      message: result.reason,
      metadata: {
        decision: result.decision,
        policyType: result.policyType,
        evaluationId: event.id,
      },
    });
  }

  return {
    evaluation: result,
    event: repo.toPublicEvaluation(event),
  };
}
