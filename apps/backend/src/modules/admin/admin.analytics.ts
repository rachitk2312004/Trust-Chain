import {
  AdminAuditActions,
  AdminPolicyDecisions,
  FeatureFlagStatuses,
  RoleKeys,
  TenantLifecycleEventTypes,
  TenantLifecycleStatuses,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { writeAdminAudit } from "./admin.audit.js";
import { adminProcessMetrics } from "./admin.observability.js";
import {
  emptyTenantQuotaUsage,
  parseTenantQuotaLimits,
  quotaUtilization,
  type TenantQuotaLimits,
  type TenantQuotaUsage,
} from "./admin.tenants.workflow.js";

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

function rate(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 10000) / 100;
}

function countByKey(rows: Array<{ key: string; _count: { _all: number } }>) {
  const out: Record<string, number> = {};
  for (const row of rows) out[row.key] = row._count._all;
  return out;
}

export type GrowthBucket = { date: string; count: number };

export function buildGrowthSeries(
  timestamps: Date[],
  days: number,
  now = new Date(),
): GrowthBucket[] {
  const buckets: GrowthBucket[] = [];
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (Math.max(1, days) - 1));

  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = ts.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  for (let i = 0; i < Math.max(1, days); i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    buckets.push({ date: key, count: counts.get(key) ?? 0 });
  }
  return buckets;
}

export function buildQuotaConsumptionMetrics(
  rows: Array<{ limits: TenantQuotaLimits; usage: TenantQuotaUsage }>,
) {
  let overLimitTenants = 0;
  const resourceTotals: Record<
    string,
    { used: number; limit: number; tenantsOver: number; avgPercent: number | null }
  > = {};

  for (const row of rows) {
    const util = quotaUtilization(row.limits, row.usage);
    let tenantOver = false;
    for (const item of util) {
      const bucket = resourceTotals[item.resource] ?? {
        used: 0,
        limit: 0,
        tenantsOver: 0,
        avgPercent: null,
      };
      bucket.used += item.used;
      bucket.limit += item.limit;
      if (item.percent != null && item.percent >= 100) {
        bucket.tenantsOver += 1;
        tenantOver = true;
      }
      resourceTotals[item.resource] = bucket;
    }
    if (tenantOver) overLimitTenants += 1;
  }

  for (const key of Object.keys(resourceTotals)) {
    const bucket = resourceTotals[key]!;
    bucket.avgPercent =
      bucket.limit <= 0 ? null : Math.round((bucket.used / bucket.limit) * 10000) / 100;
  }

  return {
    tenantsWithQuota: rows.length,
    overLimitTenants,
    resources: resourceTotals,
  };
}

export function buildAuditActivityMetrics(input: {
  total: number;
  byAction: Record<string, number>;
  successCount: number;
  failureCount: number;
  configurationChanges: number;
}) {
  return {
    total: input.total,
    successCount: input.successCount,
    failureCount: input.failureCount,
    successRate: rate(input.successCount, input.total),
    configurationChanges: input.configurationChanges,
    byAction: input.byAction,
    topActions: Object.entries(input.byAction)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([action, count]) => ({ action, count })),
  };
}

export function buildLifecycleRateMetrics(input: {
  totalTenants: number;
  suspended: number;
  restored: number;
  transferred: number;
  suspensionEvents: number;
  restorationEvents: number;
  transferEvents: number;
}) {
  return {
    suspensionRate: rate(input.suspended, input.totalTenants),
    restorationRate: rate(input.restored, input.totalTenants),
    transferRate: rate(input.transferred, input.totalTenants),
    suspensionEvents: input.suspensionEvents,
    restorationEvents: input.restorationEvents,
    transferEvents: input.transferEvents,
    current: {
      suspended: input.suspended,
      restored: input.restored,
      transferred: input.transferred,
      totalTenants: input.totalTenants,
    },
  };
}

export function buildPolicyEvaluationStatistics(input: {
  total: number;
  byDecision: Record<string, number>;
  byType: Record<string, number>;
}) {
  const allow = input.byDecision[AdminPolicyDecisions.allow] ?? 0;
  const deny = input.byDecision[AdminPolicyDecisions.deny] ?? 0;
  const conflict = input.byDecision[AdminPolicyDecisions.conflict] ?? 0;
  return {
    total: input.total,
    byDecision: input.byDecision,
    byType: input.byType,
    allowRate: rate(allow, input.total),
    denyRate: rate(deny, input.total),
    conflictRate: rate(conflict, input.total),
  };
}

export function buildFeatureFlagStatistics(input: {
  total: number;
  byStatus: Record<string, number>;
  killSwitchCount: number;
  averageRolloutPercent: number | null;
}) {
  return {
    total: input.total,
    byStatus: input.byStatus,
    active: input.byStatus[FeatureFlagStatuses.active] ?? 0,
    inactive: input.byStatus[FeatureFlagStatuses.inactive] ?? 0,
    killSwitchCount: input.killSwitchCount,
    averageRolloutPercent: input.averageRolloutPercent,
  };
}

export function buildAdminAnalyticsSummary(input: {
  tenants: { total: number; growth: GrowthBucket[]; lifecycle: ReturnType<typeof buildLifecycleRateMetrics> };
  users: { total: number; growth: GrowthBucket[] };
  organizations: { total: number; growth: GrowthBucket[] };
  policies: ReturnType<typeof buildPolicyEvaluationStatistics> & { definitions: number };
  features: ReturnType<typeof buildFeatureFlagStatistics>;
  quotas: ReturnType<typeof buildQuotaConsumptionMetrics>;
  audit: ReturnType<typeof buildAuditActivityMetrics>;
  process: ReturnType<typeof adminProcessMetrics.snapshot>;
  generatedAt?: Date;
}) {
  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    tenants: input.tenants,
    users: input.users,
    organizations: input.organizations,
    policies: input.policies,
    features: input.features,
    quotas: input.quotas,
    audit: input.audit,
    process: input.process,
  };
}

async function groupOrganizationStatus() {
  const rows = await prisma.organization.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return countByKey(rows.map((r) => ({ key: r.status, _count: r._count })));
}

async function groupPolicyEvaluationDecision() {
  const rows = await prisma.policyEvaluationEvent.groupBy({
    by: ["decision"],
    _count: { _all: true },
  });
  return countByKey(rows.map((r) => ({ key: r.decision, _count: r._count })));
}

async function groupPolicyEvaluationType() {
  const rows = await prisma.policyEvaluationEvent.groupBy({
    by: ["policyType"],
    _count: { _all: true },
  });
  const out: Record<string, number> = {};
  for (const row of rows) out[row.policyType ?? "unknown"] = row._count._all;
  return out;
}

async function groupFeatureFlagStatus() {
  const rows = await prisma.featureFlag.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  return countByKey(rows.map((r) => ({ key: r.status, _count: r._count })));
}

async function growthFor(
  findMany: () => Promise<Array<{ createdAt: Date }>>,
  days: number,
) {
  const rows = await findMany();
  return buildGrowthSeries(
    rows.map((r) => r.createdAt),
    days,
  );
}

export async function getAdminAnalytics(actorId: string, options?: { days?: number }) {
  await assertSuperAdmin(actorId);
  const started = Date.now();
  const days = Math.min(Math.max(options?.days ?? 30, 1), 90);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [
    tenantTotal,
    userTotal,
    orgTotal,
    tenantByStatus,
    tenantGrowth,
    userGrowth,
    orgGrowth,
    policyDefs,
    policyEvals,
    policyByDecision,
    policyByType,
    featureTotal,
    featureByStatus,
    killSwitchCount,
    featureRollouts,
    quotas,
    auditTotal,
    auditSuccess,
    auditFailure,
    configChanges,
    auditActions,
    suspensionEvents,
    restorationEvents,
    transferEvents,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.organization.count(),
    groupOrganizationStatus(),
    growthFor(
      () =>
        prisma.organization.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
      days,
    ),
    growthFor(
      () =>
        prisma.user.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
      days,
    ),
    growthFor(
      () =>
        prisma.organization.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
      days,
    ),
    prisma.policyDefinition.count(),
    prisma.policyEvaluationEvent.count(),
    groupPolicyEvaluationDecision(),
    groupPolicyEvaluationType(),
    prisma.featureFlag.count(),
    groupFeatureFlagStatus(),
    prisma.featureFlag.count({ where: { killSwitch: true } }),
    prisma.featureFlag.findMany({ select: { rolloutPercent: true } }),
    prisma.tenantQuota.findMany({ select: { limitsJson: true, usageJson: true } }),
    prisma.adminAuditLog.count(),
    prisma.adminAuditLog.count({ where: { success: true } }),
    prisma.adminAuditLog.count({ where: { success: false } }),
    prisma.adminAuditLog.count({
      where: {
        action: {
          in: [
            AdminAuditActions.configurationUpdate,
            AdminAuditActions.configurationRollback,
          ],
        },
      },
    }),
    prisma.adminAuditLog.groupBy({
      by: ["action"],
      _count: { _all: true },
      orderBy: { _count: { action: "desc" } },
      take: 25,
    }),
    prisma.tenantLifecycleEvent.count({
      where: { eventType: TenantLifecycleEventTypes.suspended },
    }),
    prisma.tenantLifecycleEvent.count({
      where: { eventType: TenantLifecycleEventTypes.restored },
    }),
    prisma.tenantLifecycleEvent.count({
      where: { eventType: TenantLifecycleEventTypes.transferred },
    }),
  ]);

  const avgRollout =
    featureRollouts.length === 0
      ? null
      : Math.round(
          (featureRollouts.reduce((a, r) => a + r.rolloutPercent, 0) / featureRollouts.length) *
            100,
        ) / 100;

  const quotaMetrics = buildQuotaConsumptionMetrics(
    quotas.map((q) => ({
      limits: parseTenantQuotaLimits(q.limitsJson),
      usage: q.usageJson
        ? parseTenantQuotaLimits(q.usageJson)
        : emptyTenantQuotaUsage(),
    })),
  );

  const byAction: Record<string, number> = {};
  for (const row of auditActions) byAction[row.action] = row._count._all;

  const summary = buildAdminAnalyticsSummary({
    tenants: {
      total: tenantTotal,
      growth: tenantGrowth,
      lifecycle: buildLifecycleRateMetrics({
        totalTenants: tenantTotal,
        suspended: tenantByStatus[TenantLifecycleStatuses.suspended] ?? 0,
        restored: tenantByStatus[TenantLifecycleStatuses.active] ?? 0,
        transferred: tenantByStatus[TenantLifecycleStatuses.transferred] ?? 0,
        suspensionEvents,
        restorationEvents,
        transferEvents,
      }),
    },
    users: { total: userTotal, growth: userGrowth },
    organizations: { total: orgTotal, growth: orgGrowth },
    policies: {
      definitions: policyDefs,
      ...buildPolicyEvaluationStatistics({
        total: policyEvals,
        byDecision: policyByDecision,
        byType: policyByType,
      }),
    },
    features: buildFeatureFlagStatistics({
      total: featureTotal,
      byStatus: featureByStatus,
      killSwitchCount,
      averageRolloutPercent: avgRollout,
    }),
    quotas: quotaMetrics,
    audit: buildAuditActivityMetrics({
      total: auditTotal,
      byAction,
      successCount: auditSuccess,
      failureCount: auditFailure,
      configurationChanges: configChanges,
    }),
    process: adminProcessMetrics.snapshot(),
  });

  adminProcessMetrics.recordAnalyticsRead(Date.now() - started);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.analyticsInspect,
    targetType: "analytics",
    targetId: null,
    meta: { scope: "summary", days },
  });

  return summary;
}

export async function getAdminTenantAnalytics(actorId: string, options?: { days?: number }) {
  await assertSuperAdmin(actorId);
  const started = Date.now();
  const days = Math.min(Math.max(options?.days ?? 30, 1), 90);
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - (days - 1));
  since.setUTCHours(0, 0, 0, 0);

  const [total, byStatus, growth, quotas, suspensionEvents, restorationEvents, transferEvents] =
    await Promise.all([
      prisma.organization.count(),
      groupOrganizationStatus(),
      growthFor(
        () =>
          prisma.organization.findMany({
            where: { createdAt: { gte: since } },
            select: { createdAt: true },
          }),
        days,
      ),
      prisma.tenantQuota.findMany({ select: { limitsJson: true, usageJson: true } }),
      prisma.tenantLifecycleEvent.count({
        where: { eventType: TenantLifecycleEventTypes.suspended },
      }),
      prisma.tenantLifecycleEvent.count({
        where: { eventType: TenantLifecycleEventTypes.restored },
      }),
      prisma.tenantLifecycleEvent.count({
        where: { eventType: TenantLifecycleEventTypes.transferred },
      }),
    ]);

  const result = {
    generatedAt: new Date().toISOString(),
    days,
    total,
    byStatus,
    growth,
    lifecycle: buildLifecycleRateMetrics({
      totalTenants: total,
      suspended: byStatus[TenantLifecycleStatuses.suspended] ?? 0,
      restored: byStatus[TenantLifecycleStatuses.active] ?? 0,
      transferred: byStatus[TenantLifecycleStatuses.transferred] ?? 0,
      suspensionEvents,
      restorationEvents,
      transferEvents,
    }),
    quotas: buildQuotaConsumptionMetrics(
      quotas.map((q) => ({
        limits: parseTenantQuotaLimits(q.limitsJson),
        usage: q.usageJson
          ? parseTenantQuotaLimits(q.usageJson)
          : emptyTenantQuotaUsage(),
      })),
    ),
  };

  adminProcessMetrics.recordAnalyticsRead(Date.now() - started);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.analyticsInspect,
    targetType: "analytics",
    meta: { scope: "tenants", days },
  });
  return result;
}

export async function getAdminPolicyAnalytics(actorId: string) {
  await assertSuperAdmin(actorId);
  const started = Date.now();
  const [definitions, typeRows, statusRows, evaluations, decisionRows, evalTypeRows] =
    await Promise.all([
      prisma.policyDefinition.count(),
      prisma.policyDefinition.groupBy({ by: ["policyType"], _count: { _all: true } }),
      prisma.policyDefinition.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.policyEvaluationEvent.count(),
      prisma.policyEvaluationEvent.groupBy({ by: ["decision"], _count: { _all: true } }),
      prisma.policyEvaluationEvent.groupBy({ by: ["policyType"], _count: { _all: true } }),
    ]);

  const byType = countByKey(typeRows.map((r) => ({ key: r.policyType, _count: r._count })));
  const byStatus = countByKey(statusRows.map((r) => ({ key: r.status, _count: r._count })));
  const byDecision = countByKey(decisionRows.map((r) => ({ key: r.decision, _count: r._count })));
  const evalByType: Record<string, number> = {};
  for (const row of evalTypeRows) {
    evalByType[row.policyType ?? "unknown"] = row._count._all;
  }

  const result = {
    generatedAt: new Date().toISOString(),
    definitions,
    byType,
    byStatus,
    evaluations: buildPolicyEvaluationStatistics({
      total: evaluations,
      byDecision,
      byType: evalByType,
    }),
  };

  adminProcessMetrics.recordAnalyticsRead(Date.now() - started);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.analyticsInspect,
    targetType: "analytics",
    meta: { scope: "policies" },
  });
  return result;
}

export async function getAdminAuditAnalytics(actorId: string) {
  await assertSuperAdmin(actorId);
  const started = Date.now();
  const [total, successCount, failureCount, configurationChanges, byActionRows] =
    await Promise.all([
      prisma.adminAuditLog.count(),
      prisma.adminAuditLog.count({ where: { success: true } }),
      prisma.adminAuditLog.count({ where: { success: false } }),
      prisma.adminAuditLog.count({
        where: {
          action: {
            in: [
              AdminAuditActions.configurationUpdate,
              AdminAuditActions.configurationRollback,
            ],
          },
        },
      }),
      prisma.adminAuditLog.groupBy({
        by: ["action"],
        _count: { _all: true },
        orderBy: { _count: { action: "desc" } },
        take: 50,
      }),
    ]);

  const byAction: Record<string, number> = {};
  for (const row of byActionRows) byAction[row.action] = row._count._all;

  const result = {
    generatedAt: new Date().toISOString(),
    ...buildAuditActivityMetrics({
      total,
      byAction,
      successCount,
      failureCount,
      configurationChanges,
    }),
  };

  adminProcessMetrics.recordAnalyticsRead(Date.now() - started);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.analyticsInspect,
    targetType: "analytics",
    meta: { scope: "audit" },
  });
  return result;
}

export async function getAdminFeatureAnalytics(actorId: string) {
  await assertSuperAdmin(actorId);
  const started = Date.now();
  const [total, byStatusRows, killSwitchCount, rollouts] = await Promise.all([
    prisma.featureFlag.count(),
    prisma.featureFlag.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.featureFlag.count({ where: { killSwitch: true } }),
    prisma.featureFlag.findMany({ select: { key: true, status: true, rolloutPercent: true, killSwitch: true } }),
  ]);

  const byStatus = countByKey(byStatusRows.map((r) => ({ key: r.status, _count: r._count })));
  const avgRollout =
    rollouts.length === 0
      ? null
      : Math.round(
          (rollouts.reduce((a, r) => a + r.rolloutPercent, 0) / rollouts.length) * 100,
        ) / 100;

  const result = {
    generatedAt: new Date().toISOString(),
    ...buildFeatureFlagStatistics({
      total,
      byStatus,
      killSwitchCount,
      averageRolloutPercent: avgRollout,
    }),
    flags: rollouts.map((f) => ({
      key: f.key,
      status: f.status,
      rolloutPercent: f.rolloutPercent,
      killSwitch: f.killSwitch,
    })),
  };

  adminProcessMetrics.recordAnalyticsRead(Date.now() - started);
  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.analyticsInspect,
    targetType: "analytics",
    meta: { scope: "features" },
  });
  return result;
}
