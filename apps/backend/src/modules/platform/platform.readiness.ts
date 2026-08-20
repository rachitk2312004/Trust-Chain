import {
  FeatureFlagStatuses,
  PlatformDefaults,
  PlatformHealthStatuses,
  PlatformReadinessStatuses,
  type PlatformReadinessStatus,
} from "@trustchain/config";
import {
  aggregateHealthStatus,
  validateDependencies,
  type PlatformHealthCheck,
} from "./platform.health.js";

export type FeatureFlagLike = {
  key: string;
  status: string;
  rolloutPercent: number;
  killSwitch: boolean;
  organizationId?: string | null;
};

export type TraceSpan = {
  traceId: string;
  spanId: string;
  service: string;
  operation: string;
  durationMs: number;
  status: "ok" | "error";
  timestamp: string;
};

export type TraceAggregate = {
  windowKey: string;
  spanCount: number;
  errorCount: number;
  errorRate: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  services: Record<string, { count: number; errors: number; avgMs: number }>;
};

export type PlatformMetrics = {
  generatedAt: string;
  healthStatus: string;
  readinessStatus: string;
  dependencyScore: number;
  featureFlags: {
    total: number;
    active: number;
    killSwitched: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    backend: "redis" | "database" | "memory" | "unknown";
  };
  tracing: TraceAggregate;
  process: {
    uptimeSeconds: number;
    memoryRssBytes: number;
  };
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
  );
  return sorted[idx]!;
}

/** Evaluate whether a feature flag is enabled for a subject hash bucket 0–99. */
export function evaluateFeature(
  flag: FeatureFlagLike,
  input?: { bucket?: number; organizationId?: string | null },
): { enabled: boolean; reason: string } {
  if (flag.killSwitch) {
    return { enabled: false, reason: "kill_switch" };
  }
  if (flag.status === FeatureFlagStatuses.suspended) {
    return { enabled: false, reason: "suspended" };
  }
  if (flag.status !== FeatureFlagStatuses.active) {
    return { enabled: false, reason: "inactive" };
  }
  if (
    flag.organizationId &&
    input?.organizationId &&
    flag.organizationId !== input.organizationId
  ) {
    return { enabled: false, reason: "org_mismatch" };
  }
  const bucket = input?.bucket ?? 0;
  if (flag.rolloutPercent <= 0) {
    return { enabled: false, reason: "rollout_zero" };
  }
  if (bucket < flag.rolloutPercent) {
    return { enabled: true, reason: "rollout_match" };
  }
  return { enabled: false, reason: "rollout_miss" };
}

export function aggregateTraces(
  spans: TraceSpan[],
  opts?: { windowKey?: string },
): TraceAggregate {
  const limited = spans.slice(-PlatformDefaults.traceSampleLimit);
  const durations = limited.map((s) => s.durationMs).sort((a, b) => a - b);
  const errorCount = limited.filter((s) => s.status === "error").length;
  const services: TraceAggregate["services"] = {};

  for (const span of limited) {
    const cur = services[span.service] ?? { count: 0, errors: 0, avgMs: 0 };
    const nextCount = cur.count + 1;
    cur.avgMs = Number(
      ((cur.avgMs * cur.count + span.durationMs) / nextCount).toFixed(2),
    );
    cur.count = nextCount;
    if (span.status === "error") cur.errors += 1;
    services[span.service] = cur;
  }

  return {
    windowKey: opts?.windowKey ?? "recent",
    spanCount: limited.length,
    errorCount,
    errorRate:
      limited.length === 0
        ? 0
        : Number((errorCount / limited.length).toFixed(3)),
    p50LatencyMs: Number(percentile(durations, 50).toFixed(2)),
    p95LatencyMs: Number(percentile(durations, 95).toFixed(2)),
    services,
  };
}

export function evaluateReadiness(input: {
  checks: PlatformHealthCheck[];
  criticalTargets?: readonly string[];
}): {
  status: PlatformReadinessStatus;
  score: number;
  blockers: string[];
  healthStatus: string;
  validation: ReturnType<typeof validateDependencies>;
} {
  const validation = validateDependencies({
    checks: input.checks,
    requiredTargets: input.criticalTargets,
  });
  const healthStatus = aggregateHealthStatus(input.checks);
  const blockers: string[] = [
    ...validation.missing.map((t) => `missing:${t}`),
    ...validation.down.map((t) => `down:${t}`),
  ];

  let status: PlatformReadinessStatus = PlatformReadinessStatuses.ready;
  if (!validation.valid || healthStatus === PlatformHealthStatuses.down) {
    status = PlatformReadinessStatuses.notReady;
  } else if (
    healthStatus === PlatformHealthStatuses.degraded ||
    validation.degraded.length > 0
  ) {
    status = PlatformReadinessStatuses.degraded;
  }

  return {
    status,
    score: validation.score,
    blockers,
    healthStatus,
    validation,
  };
}

export function generateMetrics(input: {
  checks: PlatformHealthCheck[];
  readinessStatus: string;
  flags: FeatureFlagLike[];
  spans: TraceSpan[];
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    backend: "redis" | "database" | "memory" | "unknown";
  };
  uptimeSeconds: number;
  memoryRssBytes: number;
  generatedAt?: Date;
}): PlatformMetrics {
  const validation = validateDependencies({ checks: input.checks });
  return {
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    healthStatus: aggregateHealthStatus(input.checks),
    readinessStatus: input.readinessStatus,
    dependencyScore: validation.score,
    featureFlags: {
      total: input.flags.length,
      active: input.flags.filter((f) => f.status === FeatureFlagStatuses.active)
        .length,
      killSwitched: input.flags.filter((f) => f.killSwitch).length,
    },
    rateLimit: input.rateLimit,
    tracing: aggregateTraces(input.spans),
    process: {
      uptimeSeconds: Math.max(0, Math.floor(input.uptimeSeconds)),
      memoryRssBytes: input.memoryRssBytes,
    },
  };
}
