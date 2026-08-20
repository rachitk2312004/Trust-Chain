import {
  FailoverModes,
  RegionStatuses,
  ReplicationModes,
  ResidencyModes,
  RoutingStrategies,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  buildResidencyReport,
  evaluateReplicationHealth,
  selectFailoverTarget,
  validateReplicationTargets,
} from "./region.replication.js";
import { enforceResidency, selectRegion, type RegionCandidate } from "./region.routing.js";

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toPublicRegion(row: {
  id: string;
  code: string;
  name: string;
  jurisdiction: string;
  endpointUrl: string;
  status: string;
  priority: number;
  latencyWeight: number;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    jurisdiction: row.jurisdiction,
    endpointUrl: row.endpointUrl,
    status: row.status,
    priority: row.priority,
    latencyWeight: row.latencyWeight,
    metadata: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toCandidates(
  rows: Array<{
    code: string;
    status: string;
    priority: number;
    latencyWeight: number;
    jurisdiction: string;
  }>,
): RegionCandidate[] {
  return rows.map((r) => ({
    code: r.code,
    status: r.status,
    priority: r.priority,
    latencyWeight: r.latencyWeight,
    jurisdiction: r.jurisdiction,
  }));
}

export async function listRegions(query: {
  status?: string;
  limit: number;
  offset: number;
}) {
  const where: Prisma.PlatformRegionWhereInput = {
    ...(query.status ? { status: query.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.platformRegion.findMany({
      where,
      orderBy: [{ priority: "asc" }, { code: "asc" }],
      take: query.limit,
      skip: query.offset,
    }),
    prisma.platformRegion.count({ where }),
  ]);
  return { regions: rows.map(toPublicRegion), total, limit: query.limit, offset: query.offset };
}

export async function createRegion(input: {
  code: string;
  name: string;
  jurisdiction: string;
  endpointUrl: string;
  status?: string;
  priority?: number;
  latencyWeight?: number;
  metadata?: Record<string, unknown> | null;
  createdById?: string | null;
  organizationId?: string;
  residency?: {
    mode?: string;
    allowedRegions?: string[];
    lockedClasses?: string[];
  };
}) {
  const existing = await prisma.platformRegion.findUnique({ where: { code: input.code } });
  if (existing) throw new AppError(409, "CONFLICT", "Region code already exists");

  const row = await prisma.platformRegion.create({
    data: {
      code: input.code,
      name: input.name,
      jurisdiction: input.jurisdiction,
      endpointUrl: input.endpointUrl,
      status: input.status ?? RegionStatuses.active,
      priority: input.priority ?? 100,
      latencyWeight: input.latencyWeight ?? 100,
      metadataJson: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      createdById: input.createdById ?? null,
    },
  });

  let orgPolicies = null;
  if (input.organizationId) {
    orgPolicies = await ensureOrgPolicies({
      organizationId: input.organizationId,
      homeRegionCode: input.code,
      residencyMode: input.residency?.mode,
      allowedRegions: input.residency?.allowedRegions ?? [input.code],
      lockedClasses: input.residency?.lockedClasses ?? ["pii"],
    });
  }

  return { region: toPublicRegion(row), orgPolicies };
}

export async function getRegion(id: string) {
  return prisma.platformRegion.findUnique({ where: { id } });
}

export async function patchRegion(
  id: string,
  input: {
    name?: string;
    jurisdiction?: string;
    endpointUrl?: string;
    status?: string;
    priority?: number;
    latencyWeight?: number;
    metadata?: Record<string, unknown> | null;
  },
) {
  const row = await prisma.platformRegion.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.jurisdiction !== undefined ? { jurisdiction: input.jurisdiction } : {}),
      ...(input.endpointUrl !== undefined ? { endpointUrl: input.endpointUrl } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.latencyWeight !== undefined ? { latencyWeight: input.latencyWeight } : {}),
      ...(input.metadata !== undefined
        ? { metadataJson: input.metadata as Prisma.InputJsonValue }
        : {}),
    },
  });
  return { region: toPublicRegion(row) };
}

export async function ensureOrgPolicies(input: {
  organizationId: string;
  homeRegionCode: string;
  residencyMode?: string;
  allowedRegions?: string[];
  lockedClasses?: string[];
  routingStrategy?: string;
  replicationMode?: string;
  replicationTargets?: string[];
  failoverMode?: string;
  primaryRegionCode?: string;
  standbyRegions?: string[];
}) {
  const residency = await prisma.orgResidencyPolicy.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      homeRegionCode: input.homeRegionCode,
      mode: input.residencyMode ?? ResidencyModes.strict,
      allowedRegionsJson: input.allowedRegions ?? [input.homeRegionCode],
      lockedClassesJson: input.lockedClasses ?? ["pii"],
    },
    update: {
      homeRegionCode: input.homeRegionCode,
      ...(input.residencyMode ? { mode: input.residencyMode } : {}),
      ...(input.allowedRegions ? { allowedRegionsJson: input.allowedRegions } : {}),
      ...(input.lockedClasses ? { lockedClassesJson: input.lockedClasses } : {}),
    },
  });

  const routing = await prisma.orgRoutingPolicy.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      strategy: input.routingStrategy ?? RoutingStrategies.home,
    },
    update: {
      ...(input.routingStrategy ? { strategy: input.routingStrategy } : {}),
    },
  });

  const replication = await prisma.orgReplicationPolicy.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      mode: input.replicationMode ?? ReplicationModes.async,
      targetRegionsJson: input.replicationTargets ?? [],
    },
    update: {
      ...(input.replicationMode ? { mode: input.replicationMode } : {}),
      ...(input.replicationTargets ? { targetRegionsJson: input.replicationTargets } : {}),
    },
  });

  const failover = await prisma.orgFailoverPolicy.upsert({
    where: { organizationId: input.organizationId },
    create: {
      organizationId: input.organizationId,
      mode: input.failoverMode ?? FailoverModes.manual,
      primaryRegionCode: input.primaryRegionCode ?? input.homeRegionCode,
      standbyRegionsJson: input.standbyRegions ?? [],
    },
    update: {
      ...(input.failoverMode ? { mode: input.failoverMode } : {}),
      ...(input.primaryRegionCode ? { primaryRegionCode: input.primaryRegionCode } : {}),
      ...(input.standbyRegions ? { standbyRegionsJson: input.standbyRegions } : {}),
    },
  });

  return { residency, routing, replication, failover };
}

export async function getRoutingDecision(input: {
  organizationId: string;
  clientRegionHint?: string;
  stickyRegion?: string;
  dataClass?: string;
}) {
  const [regions, residency, routing] = await Promise.all([
    prisma.platformRegion.findMany(),
    prisma.orgResidencyPolicy.findUnique({ where: { organizationId: input.organizationId } }),
    prisma.orgRoutingPolicy.findUnique({ where: { organizationId: input.organizationId } }),
  ]);

  if (!residency || !routing) {
    throw new AppError(400, "POLICY_MISSING", "Residency/routing policies not configured");
  }

  const decision = selectRegion({
    regions: toCandidates(regions),
    residency: {
      homeRegionCode: residency.homeRegionCode,
      mode: residency.mode,
      allowedRegions: asStringArray(residency.allowedRegionsJson),
      lockedClasses: asStringArray(residency.lockedClassesJson),
    },
    routing: {
      strategy: routing.strategy,
      stickyTtlSeconds: routing.stickyTtlSeconds,
    },
    clientRegionHint: input.clientRegionHint,
    stickyRegion: input.stickyRegion,
    dataClass: input.dataClass,
  });

  return {
    organizationId: input.organizationId,
    decision,
    residency: {
      homeRegionCode: residency.homeRegionCode,
      mode: residency.mode,
      allowedRegions: asStringArray(residency.allowedRegionsJson),
    },
    routing: { strategy: routing.strategy },
    regions: regions.map(toPublicRegion),
  };
}

export async function runFailover(input: {
  organizationId: string;
  reason: string;
  force?: boolean;
  consecutivePrimaryFailures?: number;
  triggeredById?: string | null;
  failoverPolicy?: {
    mode?: string;
    primaryRegionCode?: string;
    standbyRegions?: string[];
    healthFailThreshold?: number;
  };
}) {
  if (input.failoverPolicy) {
    const existing = await prisma.orgFailoverPolicy.findUnique({
      where: { organizationId: input.organizationId },
    });
    const residency = await prisma.orgResidencyPolicy.findUnique({
      where: { organizationId: input.organizationId },
    });
    await prisma.orgFailoverPolicy.upsert({
      where: { organizationId: input.organizationId },
      create: {
        organizationId: input.organizationId,
        mode: input.failoverPolicy.mode ?? FailoverModes.manual,
        primaryRegionCode:
          input.failoverPolicy.primaryRegionCode ??
          residency?.homeRegionCode ??
          "us-east-1",
        standbyRegionsJson: input.failoverPolicy.standbyRegions ?? [],
        healthFailThreshold: input.failoverPolicy.healthFailThreshold ?? 3,
      },
      update: {
        ...(input.failoverPolicy.mode ? { mode: input.failoverPolicy.mode } : {}),
        ...(input.failoverPolicy.primaryRegionCode
          ? { primaryRegionCode: input.failoverPolicy.primaryRegionCode }
          : {}),
        ...(input.failoverPolicy.standbyRegions
          ? { standbyRegionsJson: input.failoverPolicy.standbyRegions }
          : {}),
        ...(input.failoverPolicy.healthFailThreshold !== undefined
          ? { healthFailThreshold: input.failoverPolicy.healthFailThreshold }
          : {}),
      },
    });
    void existing;
  }

  const [regions, policy, residency] = await Promise.all([
    prisma.platformRegion.findMany(),
    prisma.orgFailoverPolicy.findUnique({ where: { organizationId: input.organizationId } }),
    prisma.orgResidencyPolicy.findUnique({ where: { organizationId: input.organizationId } }),
  ]);

  if (!policy) throw new AppError(400, "POLICY_MISSING", "Failover policy not configured");

  const selection = selectFailoverTarget({
    policy: {
      mode: policy.mode,
      primaryRegionCode: policy.primaryRegionCode,
      standbyRegions: asStringArray(policy.standbyRegionsJson),
      healthFailThreshold: policy.healthFailThreshold,
    },
    regions: toCandidates(regions),
    consecutivePrimaryFailures: input.consecutivePrimaryFailures ?? 0,
    force: input.force,
  });

  if (selection.action === "none") {
    return {
      failover: null,
      selection,
      message: selection.reason,
    };
  }

  // Residency check on target
  if (residency) {
    const check = enforceResidency({
      residency: {
        homeRegionCode: residency.homeRegionCode,
        mode: residency.mode,
        allowedRegions: asStringArray(residency.allowedRegionsJson),
        lockedClasses: asStringArray(residency.lockedClassesJson),
      },
      targetRegionCode: selection.toRegionCode!,
    });
    if (!check.allowed && residency.mode === ResidencyModes.strict) {
      throw new AppError(
        403,
        "RESIDENCY_VIOLATION",
        `Failover target blocked by residency (${check.reason})`,
      );
    }
  }

  const event = await prisma.regionFailoverEvent.create({
    data: {
      organizationId: input.organizationId,
      fromRegionCode: policy.primaryRegionCode,
      toRegionCode: selection.toRegionCode!,
      reason: input.reason,
      status: "completed",
      triggeredById: input.triggeredById ?? null,
      detailsJson: { selection } as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.orgFailoverPolicy.update({
    where: { organizationId: input.organizationId },
    data: {
      primaryRegionCode: selection.toRegionCode!,
      standbyRegionsJson: [
        policy.primaryRegionCode,
        ...asStringArray(policy.standbyRegionsJson).filter((c) => c !== selection.toRegionCode),
      ],
    },
  });

  if (residency) {
    await prisma.orgResidencyPolicy.update({
      where: { organizationId: input.organizationId },
      data: { homeRegionCode: selection.toRegionCode! },
    });
  }

  return {
    failover: {
      id: event.id,
      fromRegionCode: event.fromRegionCode,
      toRegionCode: event.toRegionCode,
      reason: event.reason,
      status: event.status,
      createdAt: event.createdAt.toISOString(),
    },
    selection,
  };
}

export async function getResidencyReport(organizationId: string) {
  const [regions, residency, routing, replication, failover, events] = await Promise.all([
    prisma.platformRegion.findMany(),
    prisma.orgResidencyPolicy.findUnique({ where: { organizationId } }),
    prisma.orgRoutingPolicy.findUnique({ where: { organizationId } }),
    prisma.orgReplicationPolicy.findUnique({ where: { organizationId } }),
    prisma.orgFailoverPolicy.findUnique({ where: { organizationId } }),
    prisma.regionFailoverEvent.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  if (!residency) {
    throw new AppError(404, "NOT_FOUND", "Residency policy not found for organization");
  }

  const allowed = asStringArray(residency.allowedRegionsJson);
  const targets = asStringArray(replication?.targetRegionsJson);
  const standbys = asStringArray(failover?.standbyRegionsJson);
  const activeCodes = regions.filter((r) => r.status === RegionStatuses.active).map((r) => r.code);

  const replicationCheck = validateReplicationTargets({
    homeRegionCode: residency.homeRegionCode,
    policy: {
      mode: replication?.mode ?? ReplicationModes.none,
      targetRegions: targets,
      lagSecondsMax: replication?.lagSecondsMax ?? 300,
    },
    availableRegionCodes: activeCodes,
  });

  const lagHealth = evaluateReplicationHealth({
    policy: {
      mode: replication?.mode ?? ReplicationModes.none,
      targetRegions: targets,
      lagSecondsMax: replication?.lagSecondsMax ?? 300,
    },
    lagByRegion: Object.fromEntries(targets.map((t) => [t, 0])),
  });

  const report = buildResidencyReport({
    homeRegionCode: residency.homeRegionCode,
    mode: residency.mode,
    allowedRegions: allowed,
    lockedClasses: asStringArray(residency.lockedClassesJson),
    activeRegionCodes: activeCodes,
    replicationTargets: targets,
    primaryRegionCode: failover?.primaryRegionCode ?? residency.homeRegionCode,
    standbyRegions: standbys,
  });

  return {
    organizationId,
    report,
    replication: {
      ...replicationCheck,
      health: lagHealth,
      mode: replication?.mode ?? ReplicationModes.none,
    },
    routing: routing
      ? { strategy: routing.strategy, stickyTtlSeconds: routing.stickyTtlSeconds }
      : null,
    failover: failover
      ? {
          mode: failover.mode,
          primaryRegionCode: failover.primaryRegionCode,
          standbyRegions: standbys,
        }
      : null,
    recentFailovers: events.map((e) => ({
      id: e.id,
      fromRegionCode: e.fromRegionCode,
      toRegionCode: e.toRegionCode,
      reason: e.reason,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
    })),
    regions: regions.map(toPublicRegion),
  };
}
