import assert from "node:assert/strict";
import {
  AdminPolicyDecisions,
  AdminRetentionDefaults,
  FeatureFlagStatuses,
} from "@trustchain/config";
import {
  buildAdminAnalyticsSummary,
  buildAuditActivityMetrics,
  buildFeatureFlagStatistics,
  buildGrowthSeries,
  buildLifecycleRateMetrics,
  buildPolicyEvaluationStatistics,
  buildQuotaConsumptionMetrics,
} from "../admin.analytics.js";
import {
  planConfigurationRepair,
  planPolicyRepair,
  planTenantRepair,
  summarizeRepairResults,
} from "../admin.operations.js";
import { AdminProcessMetrics, averageLatency } from "../admin.observability.js";
import {
  buildRetentionCutoffs,
  mergeRetentionPolicy,
  retentionCutoff,
} from "../admin.retention.js";

export function testAnalyticsGeneration(): void {
  const growth = buildGrowthSeries(
    [
      new Date("2026-08-01T10:00:00.000Z"),
      new Date("2026-08-01T12:00:00.000Z"),
      new Date("2026-08-02T09:00:00.000Z"),
    ],
    3,
    new Date("2026-08-03T00:00:00.000Z"),
  );
  assert.equal(growth.length, 3);
  assert.equal(growth[0]?.date, "2026-08-01");
  assert.equal(growth[0]?.count, 2);
  assert.equal(growth[1]?.count, 1);
  assert.equal(growth[2]?.count, 0);

  const summary = buildAdminAnalyticsSummary({
    tenants: {
      total: 10,
      growth,
      lifecycle: buildLifecycleRateMetrics({
        totalTenants: 10,
        suspended: 2,
        restored: 7,
        transferred: 1,
        suspensionEvents: 3,
        restorationEvents: 2,
        transferEvents: 1,
      }),
    },
    users: { total: 50, growth },
    organizations: { total: 10, growth },
    policies: {
      definitions: 4,
      ...buildPolicyEvaluationStatistics({
        total: 20,
        byDecision: { [AdminPolicyDecisions.allow]: 15, [AdminPolicyDecisions.deny]: 5 },
        byType: { quota: 10, permission: 10 },
      }),
    },
    features: buildFeatureFlagStatistics({
      total: 3,
      byStatus: { [FeatureFlagStatuses.active]: 2, [FeatureFlagStatuses.inactive]: 1 },
      killSwitchCount: 1,
      averageRolloutPercent: 40,
    }),
    quotas: buildQuotaConsumptionMetrics([]),
    audit: buildAuditActivityMetrics({
      total: 100,
      byAction: { "admin.user.inspect": 40 },
      successCount: 90,
      failureCount: 10,
      configurationChanges: 5,
    }),
    process: {
      analyticsReads: 1,
      operationsReprocess: 0,
      operationsCleanup: 0,
      retentionRuns: 0,
      repairs: {},
      averageAnalyticsLatencyMs: 12,
      averageOperationLatencyMs: null,
    },
    generatedAt: new Date("2026-08-03T12:00:00.000Z"),
  });

  assert.equal(summary.tenants.total, 10);
  assert.equal(summary.policies.allowRate, 75);
  assert.equal(summary.audit.successRate, 90);
  assert.equal(summary.features.killSwitchCount, 1);
  assert.equal(summary.generatedAt, "2026-08-03T12:00:00.000Z");
}

export function testQuotaMetrics(): void {
  const metrics = buildQuotaConsumptionMetrics([
    {
      limits: {
        users: 10,
        organizations: 5,
        documents: 100,
        certificates: 50,
        signatures: 50,
        storageBytes: 1000,
      },
      usage: {
        users: 10,
        organizations: 1,
        documents: 20,
        certificates: 5,
        signatures: 5,
        storageBytes: 100,
      },
    },
    {
      limits: {
        users: 20,
        organizations: 5,
        documents: 100,
        certificates: 50,
        signatures: 50,
        storageBytes: 1000,
      },
      usage: {
        users: 5,
        organizations: 1,
        documents: 10,
        certificates: 5,
        signatures: 5,
        storageBytes: 50,
      },
    },
  ]);
  assert.equal(metrics.tenantsWithQuota, 2);
  assert.equal(metrics.overLimitTenants, 1);
  assert.equal(metrics.resources.users?.tenantsOver, 1);
  assert.ok((metrics.resources.users?.avgPercent ?? 0) > 0);
}

export function testAuditMetrics(): void {
  const metrics = buildAuditActivityMetrics({
    total: 10,
    byAction: {
      "admin.configuration.update": 3,
      "admin.tenant.suspend": 2,
      "admin.user.inspect": 5,
    },
    successCount: 8,
    failureCount: 2,
    configurationChanges: 3,
  });
  assert.equal(metrics.successRate, 80);
  assert.equal(metrics.configurationChanges, 3);
  assert.equal(metrics.topActions[0]?.action, "admin.user.inspect");
  assert.equal(metrics.topActions[0]?.count, 5);
}

export function testRetention(): void {
  const cutoff = retentionCutoff(10, new Date("2026-08-11T00:00:00.000Z"));
  assert.equal(cutoff.toISOString(), "2026-08-01T00:00:00.000Z");

  const policy = mergeRetentionPolicy({ auditDays: 30, diagnosticDays: 7 });
  assert.equal(policy.auditDays, 30);
  assert.equal(policy.diagnosticDays, 7);
  assert.equal(policy.policyEventDays, AdminRetentionDefaults.policyEventDays);

  const cutoffs = buildRetentionCutoffs(policy, new Date("2026-08-31T00:00:00.000Z"));
  assert.ok(cutoffs.audit < new Date("2026-08-31T00:00:00.000Z"));
  assert.ok(cutoffs.diagnostics > cutoffs.audit);
}

export function testAdministrationOperations(): void {
  const tenantPlan = planTenantRepair({
    organizationIds: ["a", "b", "c"],
    missingQuotaIds: ["b"],
  });
  assert.deepEqual(tenantPlan.toEnsureQuota, ["b"]);
  assert.equal(tenantPlan.inspected, 3);

  const policyPlan = planPolicyRepair({
    assignments: [
      { id: "1", policyId: "p1", organizationId: "o1" },
      { id: "2", policyId: "missing", organizationId: "o1" },
      { id: "3", policyId: "p1", organizationId: "gone" },
    ],
    existingPolicyIds: new Set(["p1"]),
    existingOrgIds: new Set(["o1"]),
  });
  assert.deepEqual(policyPlan.orphanAssignmentIds, ["2", "3"]);
  assert.equal(policyPlan.valid, 1);

  const configPlan = planConfigurationRepair({
    existingKeys: ["admin.platform_settings"],
    requiredKeys: ["admin.platform_settings", "admin.retention_policy"],
  });
  assert.deepEqual(configPlan.missingKeys, ["admin.retention_policy"]);

  const summary = summarizeRepairResults([
    { target: "tenants", repaired: 2, skipped: 1, details: [] },
    { target: "policies", repaired: 1, skipped: 0, details: [] },
  ]);
  assert.equal(summary.repaired, 3);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.targetCount, 2);

  const metrics = new AdminProcessMetrics();
  metrics.recordAnalyticsRead(20);
  metrics.recordRepair("tenants");
  metrics.recordReprocess(50);
  const snap = metrics.snapshot();
  assert.equal(snap.analyticsReads, 1);
  assert.equal(snap.repairs.tenants, 1);
  assert.equal(snap.averageAnalyticsLatencyMs, 20);
  assert.equal(averageLatency([10, 20, 30]), 20);
}
