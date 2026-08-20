import {
  OpsEntityStates,
  PlatformConfigKeys,
  PlatformDefaults,
  PlatformHealthStatuses,
  PlatformHealthTargets,
} from "@trustchain/config";
import { prisma, Prisma } from "@trustchain/database";
import { createClient } from "redis";
import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../lib/errors.js";
import {
  buildHealthReport,
  type PlatformHealthCheck,
} from "./platform.health.js";
import {
  aggregateTraces,
  evaluateFeature,
  evaluateReadiness,
  generateMetrics,
  type TraceSpan,
} from "./platform.readiness.js";

/** In-process span ring for foundation tracing aggregation (not a full APM). */
const spanRing: TraceSpan[] = [];

export function recordTraceSpan(span: TraceSpan): void {
  spanRing.push(span);
  if (spanRing.length > PlatformDefaults.traceSampleLimit) {
    spanRing.splice(0, spanRing.length - PlatformDefaults.traceSampleLimit);
  }
}

export function getRecentSpans(): TraceSpan[] {
  return [...spanRing];
}

function toPublicFlag(row: {
  id: string;
  publicCode: string;
  organizationId: string | null;
  key: string;
  status: string;
  rolloutPercent: number;
  killSwitch: boolean;
  targetingJson: Prisma.JsonValue;
  experimentsJson: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    publicCode: row.publicCode,
    organizationId: row.organizationId,
    key: row.key,
    status: row.status,
    rolloutPercent: row.rolloutPercent,
    killSwitch: row.killSwitch,
    targeting: row.targetingJson,
    experiments: row.experimentsJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function probeDatabase(): Promise<PlatformHealthCheck> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: PlatformHealthTargets.database,
      status: PlatformHealthStatuses.ok,
      latencyMs: Date.now() - started,
      detail: "connected",
      required: true,
    };
  } catch (error) {
    return {
      name: PlatformHealthTargets.database,
      status: PlatformHealthStatuses.down,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
      required: true,
    };
  }
}

async function probeRedis(): Promise<PlatformHealthCheck> {
  const started = Date.now();
  const url = process.env.REDIS_URL;
  if (!url) {
    return {
      name: PlatformHealthTargets.redis,
      status: PlatformHealthStatuses.unknown,
      latencyMs: Date.now() - started,
      detail: "REDIS_URL unset — using DB/memory rate-limit fallback",
    };
  }
  let client: ReturnType<typeof createClient> | null = null;
  try {
    client = createClient({ url });
    client.on("error", () => undefined);
    await client.connect();
    const pong = await client.ping();
    await client.quit();
    return {
      name: PlatformHealthTargets.redis,
      status: pong === "PONG" ? PlatformHealthStatuses.ok : PlatformHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: `ping=${String(pong)}`,
    };
  } catch (error) {
    if (client) await client.quit().catch(() => undefined);
    return {
      name: PlatformHealthTargets.redis,
      status: PlatformHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeObjectStorage(): Promise<PlatformHealthCheck> {
  const started = Date.now();
  const configured = Boolean(
    process.env.R2_BUCKET &&
      process.env.R2_ENDPOINT &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY,
  );
  if (!configured) {
    return {
      name: PlatformHealthTargets.objectStorage,
      status: PlatformHealthStatuses.unknown,
      latencyMs: Date.now() - started,
      detail: "R2 credentials unset",
    };
  }
  try {
    const { getClient, getBucket } = await import("../../integrations/objectStorage.js");
    getClient();
    const bucket = getBucket();
    return {
      name: PlatformHealthTargets.objectStorage,
      status: PlatformHealthStatuses.ok,
      latencyMs: Date.now() - started,
      detail: `client_ready bucket=${bucket}`,
    };
  } catch (error) {
    return {
      name: PlatformHealthTargets.objectStorage,
      status: PlatformHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeBlockchain(): Promise<PlatformHealthCheck> {
  const started = Date.now();
  const rpcUrl = process.env.CHAIN_RPC_URL;
  if (!rpcUrl) {
    return {
      name: PlatformHealthTargets.blockchain,
      status: PlatformHealthStatuses.unknown,
      latencyMs: Date.now() - started,
      detail: "CHAIN_RPC_URL unset",
    };
  }
  try {
    const count = await prisma.blockchainNetwork.count();
    return {
      name: PlatformHealthTargets.blockchain,
      status: PlatformHealthStatuses.ok,
      latencyMs: Date.now() - started,
      detail: `rpc_configured networks=${count}`,
    };
  } catch (error) {
    return {
      name: PlatformHealthTargets.blockchain,
      status: PlatformHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeNotifications(): Promise<PlatformHealthCheck> {
  const started = Date.now();
  try {
    const pending = await prisma.notificationOutbox.count({
      where: { status: "pending" },
    });
    return {
      name: PlatformHealthTargets.notifications,
      status: PlatformHealthStatuses.ok,
      latencyMs: Date.now() - started,
      detail: `outbox_pending=${pending}`,
    };
  } catch (error) {
    return {
      name: PlatformHealthTargets.notifications,
      status: PlatformHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeIntegrations(): Promise<PlatformHealthCheck> {
  const started = Date.now();
  try {
    const [integrations, marketplaceInstalls] = await Promise.all([
      prisma.ecosystemIntegration.count(),
      prisma.marketplaceInstallation.count(),
    ]);
    return {
      name: PlatformHealthTargets.integrations,
      status: PlatformHealthStatuses.ok,
      latencyMs: Date.now() - started,
      detail: `integrations=${integrations} marketplace_installs=${marketplaceInstalls}`,
    };
  } catch (error) {
    return {
      name: PlatformHealthTargets.integrations,
      status: PlatformHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runHealthChecks(): Promise<PlatformHealthCheck[]> {
  return Promise.all([
    probeDatabase(),
    probeRedis(),
    probeObjectStorage(),
    probeBlockchain(),
    probeNotifications(),
    probeIntegrations(),
  ]);
}

export async function getHealth() {
  const checks = await runHealthChecks();
  const report = buildHealthReport({
    checks,
    uptimeSeconds: process.uptime(),
    memoryRssBytes: process.memoryUsage().rss,
    nodeVersion: process.version,
    pid: process.pid,
  });
  recordTraceSpan({
    traceId: createHash("sha256")
      .update(`health-${Date.now()}`)
      .digest("hex")
      .slice(0, 16),
    spanId: randomBytes(4).toString("hex"),
    service: "platform",
    operation: "health.probe",
    durationMs: checks.reduce((s, c) => s + (c.latencyMs ?? 0), 0),
    status: report.status === PlatformHealthStatuses.down ? "error" : "ok",
    timestamp: new Date().toISOString(),
  });
  return report;
}

export async function getReadiness(triggeredById?: string | null) {
  const checks = await runHealthChecks();
  const readiness = evaluateReadiness({ checks });
  const report = await prisma.platformReadinessReport.create({
    data: {
      status: readiness.status,
      score: readiness.score,
      checksJson: checks as unknown as Prisma.InputJsonValue,
      blockersJson: readiness.blockers as unknown as Prisma.InputJsonValue,
      triggeredById: triggeredById ?? null,
    },
  });
  return {
    id: report.id,
    status: readiness.status,
    score: readiness.score,
    blockers: readiness.blockers,
    healthStatus: readiness.healthStatus,
    validation: readiness.validation,
    checks,
    createdAt: report.createdAt.toISOString(),
  };
}

export async function listConfiguration() {
  const rows = await prisma.platformConfiguration.findMany({
    orderBy: { key: "asc" },
  });
  const byKey = Object.fromEntries(
    rows.map((r) => [
      r.key,
      {
        id: r.id,
        key: r.key,
        value: r.valueJson,
        description: r.description,
        updatedAt: r.updatedAt.toISOString(),
      },
    ]),
  );

  const defaults: Record<string, unknown> = {
    [PlatformConfigKeys.rateLimits]: {
      windowMs: PlatformDefaults.rateLimitWindowMs,
      maxRequests: PlatformDefaults.rateLimitMaxRequests,
    },
    [PlatformConfigKeys.tracing]: { sampleLimit: PlatformDefaults.traceSampleLimit },
    [PlatformConfigKeys.maintenance]: { enabled: false },
    [PlatformConfigKeys.dependencyTimeouts]: {
      probeTimeoutMs: PlatformDefaults.probeTimeoutMs,
    },
    [PlatformConfigKeys.readinessGates]: {
      criticalTargets: [...PlatformDefaults.criticalTargets],
    },
  };

  const entries = Object.values(PlatformConfigKeys).map((key) => {
    if (byKey[key]) return { ...byKey[key]!, default: false };
    return {
      id: null,
      key,
      value: defaults[key] ?? {},
      description: null,
      updatedAt: null,
      default: true,
    };
  });

  return { entries };
}

export async function patchConfiguration(
  entries: Array<{
    key: string;
    value: Record<string, unknown>;
    description?: string | null;
  }>,
  updatedById?: string | null,
) {
  const updated = [];
  for (const entry of entries) {
    const row = await prisma.platformConfiguration.upsert({
      where: { key: entry.key },
      create: {
        key: entry.key,
        valueJson: entry.value as Prisma.InputJsonValue,
        description: entry.description ?? null,
        updatedById: updatedById ?? null,
      },
      update: {
        valueJson: entry.value as Prisma.InputJsonValue,
        description:
          entry.description === undefined ? undefined : entry.description,
        updatedById: updatedById ?? null,
      },
    });
    updated.push({
      id: row.id,
      key: row.key,
      value: row.valueJson,
      description: row.description,
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  return { entries: updated };
}

export async function listFeatures(input?: {
  organizationId?: string;
  limit?: number;
}) {
  const rows = await prisma.featureFlag.findMany({
    where: input?.organizationId
      ? {
          OR: [
            { organizationId: input.organizationId },
            { organizationId: null },
          ],
        }
      : undefined,
    orderBy: { updatedAt: "desc" },
    take: input?.limit ?? PlatformDefaults.defaultLimit,
  });
  return {
    features: rows.map(toPublicFlag),
    evaluations: rows.map((r) => ({
      key: r.key,
      bucket0: evaluateFeature(r, { bucket: 0 }),
      bucket50: evaluateFeature(r, { bucket: 50 }),
      bucket99: evaluateFeature(r, { bucket: 99 }),
    })),
  };
}

export async function patchFeature(
  id: string,
  input: {
    status?: string;
    rolloutPercent?: number;
    killSwitch?: boolean;
    targeting?: Record<string, unknown> | null;
    experiments?: Record<string, unknown> | null;
  },
) {
  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Feature flag not found");

  const data: Prisma.FeatureFlagUpdateInput = {};
  if (input.status !== undefined) data.status = input.status;
  if (input.rolloutPercent !== undefined) data.rolloutPercent = input.rolloutPercent;
  if (input.killSwitch !== undefined) {
    data.killSwitch = input.killSwitch;
    if (input.killSwitch && input.status === undefined) {
      data.status = OpsEntityStates.suspended;
    }
  }
  if (input.targeting !== undefined) {
    data.targetingJson = (input.targeting as Prisma.InputJsonValue) ?? Prisma.DbNull;
  }
  if (input.experiments !== undefined) {
    data.experimentsJson =
      (input.experiments as Prisma.InputJsonValue) ?? Prisma.DbNull;
  }

  const row = await prisma.featureFlag.update({ where: { id }, data });
  return { feature: toPublicFlag(row) };
}

async function resolveRateLimitConfig(): Promise<{
  windowMs: number;
  maxRequests: number;
  backend: "redis" | "database" | "memory" | "unknown";
}> {
  const row = await prisma.platformConfiguration.findUnique({
    where: { key: PlatformConfigKeys.rateLimits },
  });
  const value =
    row?.valueJson && typeof row.valueJson === "object"
      ? (row.valueJson as Record<string, unknown>)
      : {};
  return {
    windowMs:
      typeof value.windowMs === "number"
        ? value.windowMs
        : PlatformDefaults.rateLimitWindowMs,
    maxRequests:
      typeof value.maxRequests === "number"
        ? value.maxRequests
        : PlatformDefaults.rateLimitMaxRequests,
    backend: process.env.REDIS_URL ? "redis" : "database",
  };
}

export async function getMetrics(opts?: { persist?: boolean }) {
  const checks = await runHealthChecks();
  const readiness = evaluateReadiness({ checks });
  const flags = await prisma.featureFlag.findMany({ take: 200 });
  const rateLimit = await resolveRateLimitConfig();
  const metrics = generateMetrics({
    checks,
    readinessStatus: readiness.status,
    flags,
    spans: getRecentSpans(),
    rateLimit,
    uptimeSeconds: process.uptime(),
    memoryRssBytes: process.memoryUsage().rss,
  });

  const tracing = aggregateTraces(getRecentSpans(), {
    windowKey: new Date().toISOString().slice(0, 13),
  });

  if (opts?.persist) {
    await prisma.platformMetricSnapshot.create({
      data: {
        scope: "global",
        metricsJson: metrics as unknown as Prisma.InputJsonValue,
      },
    });
    await prisma.platformTraceAggregate.create({
      data: {
        windowKey: tracing.windowKey,
        spanCount: tracing.spanCount,
        errorCount: tracing.errorCount,
        p50LatencyMs: tracing.p50LatencyMs,
        p95LatencyMs: tracing.p95LatencyMs,
        servicesJson: tracing.services as unknown as Prisma.InputJsonValue,
      },
    });
  }

  return { metrics, tracing };
}
