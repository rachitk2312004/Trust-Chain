import {
  PlatformDefaults,
  PlatformHealthStatuses,
  PlatformHealthTargets,
  type PlatformHealthStatus,
} from "@trustchain/config";

export type PlatformHealthCheck = {
  name: string;
  status: PlatformHealthStatus;
  latencyMs: number | null;
  detail?: string;
  required?: boolean;
};

export type PlatformHealthReport = {
  status: PlatformHealthStatus;
  generatedAt: string;
  uptimeSeconds: number;
  checks: PlatformHealthCheck[];
  process: {
    nodeVersion: string;
    pid: number;
    memoryRssBytes: number;
  };
};

export function aggregateHealthStatus(
  checks: Array<{ status: string }>,
): PlatformHealthStatus {
  if (checks.some((c) => c.status === PlatformHealthStatuses.down)) {
    return PlatformHealthStatuses.down;
  }
  if (checks.some((c) => c.status === PlatformHealthStatuses.degraded)) {
    return PlatformHealthStatuses.degraded;
  }
  if (
    checks.length > 0 &&
    checks.every((c) => c.status === PlatformHealthStatuses.unknown)
  ) {
    return PlatformHealthStatuses.unknown;
  }
  return PlatformHealthStatuses.ok;
}

/** Pure validation of dependency probe outcomes against expected targets. */
export function validateDependencies(input: {
  checks: PlatformHealthCheck[];
  requiredTargets?: readonly string[];
}): {
  valid: boolean;
  missing: string[];
  down: string[];
  degraded: string[];
  score: number;
} {
  const required = input.requiredTargets ?? PlatformDefaults.criticalTargets;
  const byName = new Map(input.checks.map((c) => [c.name, c]));
  const missing = required.filter((t) => !byName.has(t));
  const down = input.checks
    .filter((c) => c.status === PlatformHealthStatuses.down)
    .map((c) => c.name);
  const degraded = input.checks
    .filter((c) => c.status === PlatformHealthStatuses.degraded)
    .map((c) => c.name);

  const criticalDown = required.filter((t) => {
    const check = byName.get(t);
    return !check || check.status === PlatformHealthStatuses.down;
  });

  const okCount = input.checks.filter(
    (c) => c.status === PlatformHealthStatuses.ok,
  ).length;
  const score =
    input.checks.length === 0
      ? 0
      : Number((okCount / input.checks.length).toFixed(3));

  return {
    valid: missing.length === 0 && criticalDown.length === 0,
    missing,
    down,
    degraded,
    score,
  };
}

export function buildHealthReport(input: {
  checks: PlatformHealthCheck[];
  uptimeSeconds: number;
  memoryRssBytes: number;
  nodeVersion: string;
  pid: number;
  generatedAt?: Date;
}): PlatformHealthReport {
  return {
    status: aggregateHealthStatus(input.checks),
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    uptimeSeconds: Math.max(0, Math.floor(input.uptimeSeconds)),
    checks: input.checks,
    process: {
      nodeVersion: input.nodeVersion,
      pid: input.pid,
      memoryRssBytes: input.memoryRssBytes,
    },
  };
}

export function classifyProbe(input: {
  ok: boolean;
  configured: boolean;
  optional?: boolean;
  error?: string;
  latencyMs: number;
}): PlatformHealthCheck & { /* name filled by caller */ name?: string } {
  if (!input.configured) {
    return {
      status: input.optional
        ? PlatformHealthStatuses.unknown
        : PlatformHealthStatuses.degraded,
      latencyMs: input.latencyMs,
      detail: input.error ?? "not_configured",
    } as PlatformHealthCheck;
  }
  if (!input.ok) {
    return {
      status: input.optional
        ? PlatformHealthStatuses.degraded
        : PlatformHealthStatuses.down,
      latencyMs: input.latencyMs,
      detail: input.error ?? "probe_failed",
    } as PlatformHealthCheck;
  }
  return {
    status: PlatformHealthStatuses.ok,
    latencyMs: input.latencyMs,
    detail: "connected",
  } as PlatformHealthCheck;
}

export const PLATFORM_HEALTH_TARGET_NAMES = [
  PlatformHealthTargets.database,
  PlatformHealthTargets.redis,
  PlatformHealthTargets.objectStorage,
  PlatformHealthTargets.blockchain,
  PlatformHealthTargets.notifications,
  PlatformHealthTargets.integrations,
] as const;
