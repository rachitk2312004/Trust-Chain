import assert from "node:assert/strict";
import { AppError } from "../../../lib/errors.js";
import {
  aggregateErrorMetrics,
  aggregateLatencyMetrics,
  aggregateUsageSeries,
  buildAnalyticsDashboard,
  percentile,
  type AnalyticsEvent,
} from "../developer.analytics.js";
import { detectAnomalies } from "../developer.anomalies.js";
import {
  filterDeveloperAuditEvents,
  isDeveloperAuditAction,
} from "../developer.audit.js";
import { buildEndpointMetrics, buildMonitoringSnapshot } from "../developer.monitoring.js";
import {
  assertRequestQuota,
  assertResourceQuota,
  computeQuotaUtilization,
  defaultDeveloperQuotaLimits,
  isQuotaExhausted,
  parseDeveloperQuotaLimits,
  parseDeveloperQuotaUsage,
} from "../developer.quotas.js";

function sampleEvents(): AnalyticsEvent[] {
  const base = new Date("2026-08-01T12:00:00.000Z");
  const events: AnalyticsEvent[] = [];
  for (let i = 0; i < 30; i += 1) {
    events.push({
      method: i % 2 === 0 ? "GET" : "POST",
      path: i % 3 === 0 ? `/documents/${"a".repeat(8)}-bbbb-cccc-dddd-eeeeeeeeeeee` : "/health",
      statusCode: i < 22 ? 200 : i < 27 ? 400 : 500,
      durationMs: 50 + i * 20,
      createdAt: new Date(base.getTime() + i * 3_600_000),
    });
  }
  // Second day spike for volume anomaly (>> 3x baseline)
  for (let i = 0; i < 80; i += 1) {
    events.push({
      method: "GET",
      path: "/usage",
      statusCode: 200,
      durationMs: 80,
      createdAt: new Date("2026-08-03T10:00:00.000Z"),
    });
  }
  return events;
}

export function testQuotaEnforcement(): void {
  const limits = defaultDeveloperQuotaLimits({
    requestsPerDay: 10,
    requestsPerMonth: 100,
    maxApiKeys: 2,
    maxWebhooks: 2,
    maxServiceAccounts: 1,
  });
  const usage = parseDeveloperQuotaUsage({
    requestsToday: 10,
    requestsMonth: 50,
    apiKeys: 2,
    webhooks: 1,
    serviceAccounts: 1,
  });

  assert.equal(isQuotaExhausted(limits, usage), true);
  assert.throws(() => assertRequestQuota(limits, usage), (err: unknown) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.code, "DEVELOPER_QUOTA_EXCEEDED");
    return true;
  });
  assert.throws(() => assertResourceQuota(limits, usage, "maxApiKeys"), (err: unknown) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.code, "DEVELOPER_QUOTA_EXCEEDED");
    return true;
  });
  assert.doesNotThrow(() => assertResourceQuota(limits, usage, "maxWebhooks"));

  const util = computeQuotaUtilization(limits, usage);
  assert.equal(util.find((u) => u.key === "requestsPerDay")?.exhausted, true);
  assert.equal(util.find((u) => u.key === "maxWebhooks")?.exhausted, false);

  const parsed = parseDeveloperQuotaLimits({ requestsPerDay: 5.9, maxApiKeys: 3 });
  assert.equal(parsed.requestsPerDay, 5);
  assert.equal(parsed.maxApiKeys, 3);
  assert.ok(parsed.requestsPerMonth > 0);
}

export function testAnalyticsAggregation(): void {
  const events = sampleEvents().slice(0, 30);
  const series = aggregateUsageSeries(events);
  assert.ok(series.length >= 1);
  assert.equal(
    series.reduce((sum, row) => sum + row.requests, 0),
    events.length,
  );

  const errors = aggregateErrorMetrics(events);
  assert.equal(errors.totalRequests, 30);
  assert.equal(errors.errors, 8);
  assert.ok(errors.errorRate > 0);
  assert.ok(errors.byStatus.some((s) => s.statusCode === 400));

  const latency = aggregateLatencyMetrics(events);
  assert.equal(latency.samples, 30);
  assert.ok((latency.p95Ms ?? 0) >= (latency.p50Ms ?? 0));
  assert.equal(percentile([1, 2, 3, 4, 5], 50), 3);
  assert.equal(percentile([], 50), null);
}

export function testAnomalyDetection(): void {
  const healthy: AnalyticsEvent[] = Array.from({ length: 25 }, (_, i) => ({
    method: "GET",
    path: "/health",
    statusCode: 200,
    durationMs: 40,
    createdAt: new Date(`2026-08-01T${String(i % 24).padStart(2, "0")}:00:00.000Z`),
  }));
  assert.equal(detectAnomalies(healthy).length, 0);

  const failing: AnalyticsEvent[] = Array.from({ length: 25 }, (_, i) => ({
    method: "GET",
    path: "/documents",
    statusCode: i < 10 ? 200 : 500,
    durationMs: 100,
    createdAt: new Date(`2026-08-01T${String(i % 24).padStart(2, "0")}:00:00.000Z`),
  }));
  const findings = detectAnomalies(failing);
  assert.ok(findings.some((f) => f.type === "error_rate"));

  const slow: AnalyticsEvent[] = Array.from({ length: 25 }, (_, i) => ({
    method: "POST",
    path: "/certificates",
    statusCode: 200,
    durationMs: 6_000,
    createdAt: new Date(`2026-08-01T${String(i % 24).padStart(2, "0")}:00:00.000Z`),
  }));
  assert.ok(detectAnomalies(slow).some((f) => f.type === "latency" && f.severity === "critical"));

  const spike = sampleEvents();
  assert.ok(detectAnomalies(spike).some((f) => f.type === "volume_spike"));
}

export function testAuditQueries(): void {
  assert.equal(isDeveloperAuditAction("developer.api.request"), true);
  assert.equal(isDeveloperAuditAction("admin.tenant.suspend"), false);

  const events = [
    {
      action: "developer.api.request",
      actorUserId: "u1",
      targetType: "api_key",
      targetId: "k1",
      success: true,
      createdAt: "2026-08-01T00:00:00.000Z",
      meta: { path: "/health" },
    },
    {
      action: "developer.key.create",
      actorUserId: "u2",
      targetType: "api_key",
      targetId: "k2",
      success: false,
      createdAt: "2026-08-02T00:00:00.000Z",
      meta: { name: "prod" },
    },
    {
      action: "admin.user.suspend",
      actorUserId: "u1",
      targetType: "user",
      targetId: "u9",
      success: true,
      createdAt: "2026-08-03T00:00:00.000Z",
    },
  ];

  const filtered = filterDeveloperAuditEvents(events, { q: "prod" });
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0]!.action, "developer.key.create");

  const fails = filterDeveloperAuditEvents(events, { success: false });
  assert.equal(fails.length, 1);
}

export function testDashboardCalculations(): void {
  const events = sampleEvents().slice(0, 30);
  const dashboard = buildAnalyticsDashboard(events);
  assert.equal(dashboard.totals.requests, 30);
  assert.equal(dashboard.totals.errors, 8);
  assert.ok(dashboard.usage.length >= 1);
  assert.ok(dashboard.latency.p95Ms != null);

  const endpoints = buildEndpointMetrics(events);
  assert.ok(endpoints.length >= 1);
  assert.ok(endpoints.some((e) => e.path.includes("/:id") || e.path === "/health"));

  const monitoring = buildMonitoringSnapshot(events);
  assert.ok(["healthy", "degraded", "critical"].includes(monitoring.status));
  assert.equal(monitoring.requests, 30);
}
