import assert from "node:assert/strict";
import { AdminAuditActions, AdminHealthStatuses } from "@trustchain/config";
import { filterAuditEvents, matchesAuditFilter } from "../admin.audit.js";
import {
  extractConfigurationHistoryMeta,
  filterConfigurationHistory,
  resolveRollbackValue,
} from "../admin.configuration.js";
import { aggregateHealthStatus, buildHealthReport } from "../admin.health.js";
import { buildInspectionSections, classifyCount } from "../admin.inspection.js";

export function testInspectionLogic(): void {
  assert.equal(classifyCount(0), "empty");
  assert.equal(classifyCount(3), "ok");

  const sections = buildInspectionSections({
    tenants: { total: 2, byStatus: { active: 2 }, sample: [] },
    quotas: { tenantsWithQuota: 1, overLimit: 1, samples: [] },
    features: { total: 3, active: 2, killed: 1, sample: [] },
    audit: { total: 10, recent: [] },
    configuration: { total: 2, keys: ["a", "b"] },
  });
  assert.equal(sections.length, 5);
  assert.equal(sections.find((s) => s.id === "quotas")?.status, "warning");
  assert.equal(sections.find((s) => s.id === "features")?.status, "warning");
  assert.equal(sections.find((s) => s.id === "tenants")?.status, "ok");
}

export function testRollbackHandling(): void {
  const entry = {
    auditId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    key: "admin.platform_settings",
    action: AdminAuditActions.configurationUpdate,
    previousValue: { maintenance: false },
    newValue: { maintenance: true },
    description: null,
    actorUserId: null,
    createdAt: "2026-08-03T00:00:00.000Z",
  };
  assert.deepEqual(resolveRollbackValue(entry), { maintenance: false });

  assert.throws(() =>
    resolveRollbackValue({
      ...entry,
      previousValue: undefined,
    }),
  );
}

export function testConfigurationHistory(): void {
  const parsed = extractConfigurationHistoryMeta({
    key: "admin.maintenance_mode",
    previousValue: false,
    newValue: true,
    description: "toggle",
  });
  assert.equal(parsed.key, "admin.maintenance_mode");
  assert.equal(parsed.previousValue, false);
  assert.equal(parsed.newValue, true);

  const history = filterConfigurationHistory(
    [
      {
        id: "1",
        action: AdminAuditActions.configurationUpdate,
        actorUserId: null,
        meta: { key: "a", previousValue: 1, newValue: 2 },
        createdAt: "2026-08-03T01:00:00.000Z",
      },
      {
        id: "2",
        action: AdminAuditActions.roleAssign,
        actorUserId: null,
        meta: { key: "a" },
        createdAt: "2026-08-03T02:00:00.000Z",
      },
      {
        id: "3",
        action: AdminAuditActions.configurationRollback,
        actorUserId: null,
        meta: { key: "b", previousValue: 9, newValue: 8, rolledBack: true },
        createdAt: "2026-08-03T03:00:00.000Z",
      },
    ],
    { key: "a" },
  );
  assert.equal(history.length, 1);
  assert.equal(history[0]!.auditId, "1");
}

export function testAuditFiltering(): void {
  const events = [
    {
      action: AdminAuditActions.tenantSuspend,
      actorUserId: "u1",
      targetType: "tenant",
      targetId: "t1",
      success: true,
      createdAt: "2026-08-03T10:00:00.000Z",
      meta: { reason: "abuse" },
    },
    {
      action: AdminAuditActions.configurationUpdate,
      actorUserId: "u2",
      targetType: "system_configuration",
      targetId: "c1",
      success: true,
      createdAt: "2026-08-03T11:00:00.000Z",
      meta: { key: "admin.platform_settings" },
    },
    {
      action: AdminAuditActions.tenantSuspend,
      actorUserId: "u1",
      targetType: "tenant",
      targetId: "t2",
      success: false,
      createdAt: "2026-08-03T12:00:00.000Z",
      meta: {},
    },
  ];

  assert.equal(matchesAuditFilter(events[0]!, { action: AdminAuditActions.tenantSuspend }), true);
  assert.equal(filterAuditEvents(events, { targetType: "tenant" }).length, 2);
  assert.equal(filterAuditEvents(events, { success: false }).length, 1);
  assert.equal(filterAuditEvents(events, { q: "platform_settings" }).length, 1);
  assert.equal(filterAuditEvents(events, { from: "2026-08-03T11:30:00.000Z" }).length, 1);
}

export function testHealthReporting(): void {
  assert.equal(
    aggregateHealthStatus([
      { status: AdminHealthStatuses.ok },
      { status: AdminHealthStatuses.degraded },
    ]),
    AdminHealthStatuses.degraded,
  );
  assert.equal(
    aggregateHealthStatus([
      { status: AdminHealthStatuses.ok },
      { status: AdminHealthStatuses.down },
    ]),
    AdminHealthStatuses.down,
  );

  const report = buildHealthReport({
    checks: [
      { name: "database", status: AdminHealthStatuses.ok, latencyMs: 3 },
      { name: "admin_audit", status: AdminHealthStatuses.ok, latencyMs: 1 },
    ],
    uptimeSeconds: 12.7,
    memoryRssBytes: 1024,
    nodeVersion: "v22.0.0",
    pid: 42,
    generatedAt: new Date("2026-08-03T00:00:00.000Z"),
  });
  assert.equal(report.status, AdminHealthStatuses.ok);
  assert.equal(report.uptimeSeconds, 12);
  assert.equal(report.checks.length, 2);
  assert.equal(report.process.pid, 42);
}
