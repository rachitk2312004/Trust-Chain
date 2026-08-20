import {
  AdminAuditActions,
  AdminOperationTargetList,
  AdminOperationTargets,
  RoleKeys,
  SystemConfigKeys,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAdminAudit } from "./admin.audit.js";
import { getAdminHealth } from "./admin.health.js";
import { getAdminInspection } from "./admin.inspection.js";
import { adminProcessMetrics } from "./admin.observability.js";
import {
  mergeRetentionPolicy,
  previewAdminRetention,
  runAdminRetentionCleanup,
  type AdminRetentionPolicy,
} from "./admin.retention.js";
import * as tenantRepo from "./admin.tenants.repository.js";
import {
  defaultTenantQuotaLimits,
  emptyTenantQuotaUsage,
  parseTenantQuotaLimits,
} from "./admin.tenants.workflow.js";

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

export type AdminRepairResult = {
  target: string;
  repaired: number;
  skipped: number;
  details: unknown[];
};

export function planTenantRepair(input: {
  organizationIds: string[];
  missingQuotaIds: string[];
}): { toEnsureQuota: string[]; inspected: number } {
  const missing = new Set(input.missingQuotaIds);
  return {
    inspected: input.organizationIds.length,
    toEnsureQuota: input.organizationIds.filter((id) => missing.has(id)),
  };
}

export function planPolicyRepair(input: {
  assignments: Array<{ id: string; policyId: string; organizationId: string }>;
  existingPolicyIds: Set<string>;
  existingOrgIds: Set<string>;
}): { orphanAssignmentIds: string[]; valid: number } {
  const orphanAssignmentIds: string[] = [];
  let valid = 0;
  for (const a of input.assignments) {
    if (!input.existingPolicyIds.has(a.policyId) || !input.existingOrgIds.has(a.organizationId)) {
      orphanAssignmentIds.push(a.id);
    } else {
      valid += 1;
    }
  }
  return { orphanAssignmentIds, valid };
}

export function planConfigurationRepair(input: {
  existingKeys: string[];
  requiredKeys: string[];
}): { missingKeys: string[]; present: number } {
  const existing = new Set(input.existingKeys);
  const missingKeys = input.requiredKeys.filter((k) => !existing.has(k));
  return {
    missingKeys,
    present: input.requiredKeys.length - missingKeys.length,
  };
}

export function summarizeRepairResults(results: AdminRepairResult[]) {
  return {
    targetCount: results.length,
    repaired: results.reduce((a, r) => a + r.repaired, 0),
    skipped: results.reduce((a, r) => a + r.skipped, 0),
    results,
  };
}

async function repairTenants(
  actorId: string,
  tenantIds: string[] | undefined,
  dryRun: boolean,
): Promise<AdminRepairResult> {
  const orgs =
    tenantIds && tenantIds.length > 0
      ? await prisma.organization.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true, status: true },
          take: 100,
        })
      : await prisma.organization.findMany({
          select: { id: true, name: true, status: true },
          take: 100,
          orderBy: { updatedAt: "asc" },
        });

  const quotas = await prisma.tenantQuota.findMany({
    where: { organizationId: { in: orgs.map((o) => o.id) } },
    select: { organizationId: true },
  });
  const withQuota = new Set(quotas.map((q) => q.organizationId));
  const plan = planTenantRepair({
    organizationIds: orgs.map((o) => o.id),
    missingQuotaIds: orgs.filter((o) => !withQuota.has(o.id)).map((o) => o.id),
  });

  const details: unknown[] = [];
  let repaired = 0;

  for (const org of orgs) {
    const needsQuota = plan.toEnsureQuota.includes(org.id);
    if (dryRun) {
      details.push({
        organizationId: org.id,
        name: org.name,
        status: org.status,
        action: needsQuota ? "ensure_quota" : "refresh_usage",
      });
      if (needsQuota) repaired += 1;
      continue;
    }

    await tenantRepo.ensureDefaultQuota(org.id, defaultTenantQuotaLimits(), actorId);
    const usage = await tenantRepo.measureTenantUsage(org.id);
    const quota = await tenantRepo.ensureDefaultQuota(org.id, null, actorId);
    const limits = parseTenantQuotaLimits(quota.limitsJson);
    await tenantRepo.upsertTenantQuota({
      organizationId: org.id,
      limits,
      usage,
      updatedById: actorId,
    });
    repaired += 1;
    details.push({
      organizationId: org.id,
      name: org.name,
      action: needsQuota ? "ensured_quota_and_usage" : "refreshed_usage",
      usage,
    });
    adminProcessMetrics.recordRepair(AdminOperationTargets.tenants);
  }

  return {
    target: AdminOperationTargets.tenants,
    repaired,
    skipped: Math.max(0, orgs.length - repaired),
    details,
  };
}

async function repairPolicies(dryRun: boolean): Promise<AdminRepairResult> {
  const [assignments, policies, orgs] = await Promise.all([
    prisma.policyAssignment.findMany({
      select: { id: true, policyId: true, organizationId: true },
    }),
    prisma.policyDefinition.findMany({ select: { id: true } }),
    prisma.organization.findMany({ select: { id: true } }),
  ]);

  const plan = planPolicyRepair({
    assignments,
    existingPolicyIds: new Set(policies.map((p) => p.id)),
    existingOrgIds: new Set(orgs.map((o) => o.id)),
  });

  if (dryRun) {
    return {
      target: AdminOperationTargets.policies,
      repaired: plan.orphanAssignmentIds.length,
      skipped: plan.valid,
      details: plan.orphanAssignmentIds.map((id) => ({ assignmentId: id, action: "delete_orphan" })),
    };
  }

  if (plan.orphanAssignmentIds.length > 0) {
    await prisma.policyAssignment.deleteMany({
      where: { id: { in: plan.orphanAssignmentIds } },
    });
  }

  // Reactivate parent links that point at missing parents
  const withParent = await prisma.policyDefinition.findMany({
    where: { parentPolicyId: { not: null } },
    select: { id: true, parentPolicyId: true },
  });
  const policyIds = new Set(policies.map((p) => p.id));
  let clearedParents = 0;
  for (const row of withParent) {
    if (row.parentPolicyId && !policyIds.has(row.parentPolicyId)) {
      await prisma.policyDefinition.update({
        where: { id: row.id },
        data: { parentPolicyId: null },
      });
      clearedParents += 1;
    }
  }

  adminProcessMetrics.recordRepair(AdminOperationTargets.policies);
  return {
    target: AdminOperationTargets.policies,
    repaired: plan.orphanAssignmentIds.length + clearedParents,
    skipped: plan.valid,
    details: [
      { orphanAssignmentsRemoved: plan.orphanAssignmentIds.length },
      { brokenParentLinksCleared: clearedParents },
    ],
  };
}

async function repairConfiguration(actorId: string, dryRun: boolean): Promise<AdminRepairResult> {
  const requiredKeys = Object.values(SystemConfigKeys);
  const existing = await prisma.systemConfiguration.findMany({
    select: { key: true },
  });
  const plan = planConfigurationRepair({
    existingKeys: existing.map((e) => e.key),
    requiredKeys,
  });

  if (dryRun) {
    return {
      target: AdminOperationTargets.configuration,
      repaired: plan.missingKeys.length,
      skipped: plan.present,
      details: plan.missingKeys.map((key) => ({ key, action: "create_default" })),
    };
  }

  const defaults: Record<string, unknown> = {
    [SystemConfigKeys.roleCapabilities]: {},
    [SystemConfigKeys.platformSettings]: {},
    [SystemConfigKeys.maintenanceMode]: false,
    [SystemConfigKeys.defaultTenantQuotas]: defaultTenantQuotaLimits(),
    [SystemConfigKeys.retentionPolicy]: mergeRetentionPolicy(),
  };

  const details: unknown[] = [];
  for (const key of plan.missingKeys) {
    await prisma.systemConfiguration.create({
      data: {
        key,
        valueJson: (defaults[key] ?? {}) as object,
        description: `Auto-repaired default for ${key}`,
        updatedById: actorId,
      },
    });
    details.push({ key, action: "created" });
    adminProcessMetrics.recordRepair(AdminOperationTargets.configuration);
  }

  return {
    target: AdminOperationTargets.configuration,
    repaired: plan.missingKeys.length,
    skipped: plan.present,
    details,
  };
}

async function repairAudit(dryRun: boolean): Promise<AdminRepairResult> {
  // Soft integrity check: count orphaned actor references (informational) + no hard delete.
  const [total, withActor, withoutActor] = await Promise.all([
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.count({ where: { actorUserId: { not: null } } }),
    prisma.adminAuditLog.count({ where: { actorUserId: null } }),
  ]);

  return {
    target: AdminOperationTargets.audit,
    repaired: dryRun ? 0 : 0,
    skipped: total,
    details: [
      {
        total,
        withActor,
        withoutActor,
        note: "Audit repair is diagnostic-only; rows are retained for integrity.",
      },
    ],
  };
}

async function repairDiagnostics(
  actorId: string,
  dryRun: boolean,
): Promise<AdminRepairResult & { report?: unknown }> {
  if (dryRun) {
    return {
      target: AdminOperationTargets.diagnostics,
      repaired: 0,
      skipped: 1,
      details: [{ action: "would_generate_diagnostic_report" }],
    };
  }

  const [health, inspection] = await Promise.all([
    getAdminHealth(actorId, { recordAudit: false }),
    getAdminInspection(actorId),
  ]);

  adminProcessMetrics.recordRepair(AdminOperationTargets.diagnostics);
  return {
    target: AdminOperationTargets.diagnostics,
    repaired: 1,
    skipped: 0,
    details: [
      { healthStatus: health.status, inspectionSections: inspection.sections.length },
    ],
    report: { health, inspection },
  };
}

export async function runAdminOperationsReprocess(
  actorId: string,
  input: {
    targets?: string[];
    tenantIds?: string[];
    dryRun?: boolean;
  },
) {
  await assertSuperAdmin(actorId);
  const started = Date.now();
  const dryRun = input.dryRun === true;
  const targets =
    input.targets && input.targets.length > 0
      ? input.targets.filter((t) =>
          (AdminOperationTargetList as string[]).includes(t),
        )
      : [...AdminOperationTargetList];

  const results: AdminRepairResult[] = [];
  let diagnosticReport: unknown;

  for (const target of targets) {
    if (target === AdminOperationTargets.tenants) {
      results.push(await repairTenants(actorId, input.tenantIds, dryRun));
    } else if (target === AdminOperationTargets.policies) {
      results.push(await repairPolicies(dryRun));
    } else if (target === AdminOperationTargets.configuration) {
      results.push(await repairConfiguration(actorId, dryRun));
    } else if (target === AdminOperationTargets.audit) {
      results.push(await repairAudit(dryRun));
    } else if (target === AdminOperationTargets.diagnostics) {
      const diag = await repairDiagnostics(actorId, dryRun);
      diagnosticReport = diag.report;
      results.push(diag);
    }
  }

  const summary = summarizeRepairResults(results);
  adminProcessMetrics.recordReprocess(Date.now() - started);

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.operationsReprocess,
    targetType: "operations",
    meta: { targets, dryRun, repaired: summary.repaired, skipped: summary.skipped },
  });

  return {
    dryRun,
    targets,
    ...summary,
    diagnostics: diagnosticReport ?? null,
    process: adminProcessMetrics.snapshot(),
  };
}

export async function runAdminOperationsCleanup(
  actorId: string,
  input?: Partial<AdminRetentionPolicy> & { dryRun?: boolean },
) {
  await assertSuperAdmin(actorId);
  const started = Date.now();
  const dryRun = input?.dryRun === true;
  const policy = mergeRetentionPolicy(input);

  const result = dryRun
    ? await runAdminRetentionCleanup(policy, { dryRun: true })
    : await runAdminRetentionCleanup(policy, { dryRun: false });

  adminProcessMetrics.recordCleanup(Date.now() - started);

  await writeAdminAudit({
    actorUserId: actorId,
    action: dryRun
      ? AdminAuditActions.operationsCleanup
      : AdminAuditActions.retentionCleanup,
    targetType: "operations",
    meta: {
      dryRun,
      deletedAudit: result.deletedAudit,
      deletedPolicyEvents: result.deletedPolicyEvents,
      deletedLifecycleEvents: result.deletedLifecycleEvents,
      deletedConfigurationAudits: result.deletedConfigurationAudits,
      deletedDiagnostics: result.deletedDiagnostics,
    },
  });

  const preview = dryRun ? null : await previewAdminRetention(policy);

  return {
    cleanup: result,
    remainingEligible: preview,
    process: adminProcessMetrics.snapshot(),
  };
}

/** Tenant inspection helper for operations panel (reuses org+quota snapshot). */
export async function inspectTenantForOperations(actorId: string, tenantId: string) {
  await assertSuperAdmin(actorId);
  const org = await prisma.organization.findUnique({
    where: { id: tenantId },
    include: {
      tenantQuota: true,
      tenantLifecycleEvents: { orderBy: { createdAt: "desc" }, take: 10 },
      _count: { select: { memberships: true, documents: true } },
    },
  });
  if (!org) throw new AppError(404, "NOT_FOUND", "Tenant not found");

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.tenantInspect,
    targetType: "tenant",
    targetId: tenantId,
    organizationId: tenantId,
    meta: { source: "operations" },
  });

  return {
    tenant: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      status: org.status,
      parentOrganizationId: org.parentOrganizationId,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    },
    quota: org.tenantQuota
      ? {
          limits: parseTenantQuotaLimits(org.tenantQuota.limitsJson),
          usage: org.tenantQuota.usageJson
            ? parseTenantQuotaLimits(org.tenantQuota.usageJson)
            : emptyTenantQuotaUsage(),
        }
      : null,
    lifecycle: org.tenantLifecycleEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      createdAt: e.createdAt.toISOString(),
    })),
    counts: org._count,
  };
}
