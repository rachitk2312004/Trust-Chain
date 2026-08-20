import assert from "node:assert/strict";
import {
  PlatformHealthStatuses,
  PlatformHealthTargets,
  PlatformReadinessStatuses,
} from "@trustchain/config";
import {
  aggregateHealthStatus,
  validateDependencies,
} from "../platform.health.js";
import {
  aggregateTraces,
  evaluateFeature,
  evaluateReadiness,
  generateMetrics,
  type TraceSpan,
} from "../platform.readiness.js";

export function testReadinessChecks(): void {
  const ready = evaluateReadiness({
    checks: [
      {
        name: PlatformHealthTargets.database,
        status: PlatformHealthStatuses.ok,
        latencyMs: 5,
      },
      {
        name: PlatformHealthTargets.redis,
        status: PlatformHealthStatuses.unknown,
        latencyMs: 1,
      },
    ],
  });
  assert.equal(ready.status, PlatformReadinessStatuses.ready);
  assert.equal(ready.blockers.length, 0);

  const blocked = evaluateReadiness({
    checks: [
      {
        name: PlatformHealthTargets.database,
        status: PlatformHealthStatuses.down,
        latencyMs: 10,
      },
    ],
  });
  assert.equal(blocked.status, PlatformReadinessStatuses.notReady);
  assert.ok(blocked.blockers.some((b) => b.startsWith("down:")));
}

export function testFeatureEvaluation(): void {
  const on = evaluateFeature(
    {
      key: "beta.ui",
      status: "active",
      rolloutPercent: 50,
      killSwitch: false,
    },
    { bucket: 10 },
  );
  assert.equal(on.enabled, true);
  assert.equal(on.reason, "rollout_match");

  const off = evaluateFeature(
    {
      key: "beta.ui",
      status: "active",
      rolloutPercent: 50,
      killSwitch: false,
    },
    { bucket: 80 },
  );
  assert.equal(off.enabled, false);

  const killed = evaluateFeature({
    key: "beta.ui",
    status: "active",
    rolloutPercent: 100,
    killSwitch: true,
  });
  assert.equal(killed.enabled, false);
  assert.equal(killed.reason, "kill_switch");
}

export function testDependencyValidation(): void {
  const ok = validateDependencies({
    checks: [
      {
        name: PlatformHealthTargets.database,
        status: PlatformHealthStatuses.ok,
        latencyMs: 2,
      },
      {
        name: PlatformHealthTargets.notifications,
        status: PlatformHealthStatuses.degraded,
        latencyMs: 4,
      },
    ],
  });
  assert.equal(ok.valid, true);
  assert.deepEqual(ok.degraded, [PlatformHealthTargets.notifications]);

  const bad = validateDependencies({
    checks: [
      {
        name: PlatformHealthTargets.redis,
        status: PlatformHealthStatuses.ok,
        latencyMs: 1,
      },
    ],
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.missing.includes(PlatformHealthTargets.database));

  assert.equal(
    aggregateHealthStatus([
      { status: PlatformHealthStatuses.ok },
      { status: PlatformHealthStatuses.degraded },
    ]),
    PlatformHealthStatuses.degraded,
  );
}

export function testTracingAggregation(): void {
  const spans: TraceSpan[] = [
    {
      traceId: "t1",
      spanId: "s1",
      service: "api",
      operation: "GET /health",
      durationMs: 10,
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      traceId: "t2",
      spanId: "s2",
      service: "api",
      operation: "GET /ready",
      durationMs: 30,
      status: "ok",
      timestamp: new Date().toISOString(),
    },
    {
      traceId: "t3",
      spanId: "s3",
      service: "worker",
      operation: "notify",
      durationMs: 100,
      status: "error",
      timestamp: new Date().toISOString(),
    },
  ];
  const agg = aggregateTraces(spans, { windowKey: "test" });
  assert.equal(agg.spanCount, 3);
  assert.equal(agg.errorCount, 1);
  assert.equal(agg.errorRate, 0.333);
  assert.ok(agg.p95LatencyMs >= agg.p50LatencyMs);
  assert.ok(agg.services.api);
  assert.ok(agg.services.worker);
}

export function testMetricsGeneration(): void {
  const metrics = generateMetrics({
    checks: [
      {
        name: PlatformHealthTargets.database,
        status: PlatformHealthStatuses.ok,
        latencyMs: 3,
      },
    ],
    readinessStatus: PlatformReadinessStatuses.ready,
    flags: [
      {
        key: "a",
        status: "active",
        rolloutPercent: 100,
        killSwitch: false,
      },
      {
        key: "b",
        status: "inactive",
        rolloutPercent: 0,
        killSwitch: true,
      },
    ],
    spans: [],
    rateLimit: { windowMs: 60000, maxRequests: 100, backend: "database" },
    uptimeSeconds: 42,
    memoryRssBytes: 1024,
  });
  assert.equal(metrics.healthStatus, PlatformHealthStatuses.ok);
  assert.equal(metrics.readinessStatus, PlatformReadinessStatuses.ready);
  assert.equal(metrics.featureFlags.total, 2);
  assert.equal(metrics.featureFlags.active, 1);
  assert.equal(metrics.featureFlags.killSwitched, 1);
  assert.equal(metrics.rateLimit.backend, "database");
  assert.equal(metrics.process.uptimeSeconds, 42);
}
