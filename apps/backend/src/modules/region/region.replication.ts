import { FailoverModes, RegionStatuses, ReplicationModes } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import type { RegionCandidate } from "./region.routing.js";

export type ReplicationPolicyEval = {
  mode: string;
  targetRegions: string[];
  lagSecondsMax: number;
};

export type FailoverPolicyEval = {
  mode: string;
  primaryRegionCode: string;
  standbyRegions: string[];
  healthFailThreshold: number;
};

export function validateReplicationTargets(input: {
  homeRegionCode: string;
  policy: ReplicationPolicyEval;
  availableRegionCodes: string[];
}): { ok: boolean; targets: string[]; reason?: string } {
  if (input.policy.mode === ReplicationModes.none) {
    return { ok: true, targets: [] };
  }
  const available = new Set(input.availableRegionCodes);
  const targets = input.policy.targetRegions.filter(
    (code) => code !== input.homeRegionCode && available.has(code),
  );
  if (input.policy.targetRegions.length > 0 && targets.length === 0) {
    return { ok: false, targets: [], reason: "no_valid_targets" };
  }
  return { ok: true, targets };
}

export function evaluateReplicationHealth(input: {
  policy: ReplicationPolicyEval;
  lagByRegion: Record<string, number>;
}): { healthy: boolean; violations: Array<{ region: string; lagSeconds: number }> } {
  if (input.policy.mode === ReplicationModes.none) {
    return { healthy: true, violations: [] };
  }
  const violations: Array<{ region: string; lagSeconds: number }> = [];
  for (const region of input.policy.targetRegions) {
    const lag = input.lagByRegion[region] ?? Number.POSITIVE_INFINITY;
    const max =
      input.policy.mode === ReplicationModes.sync ? 0 : input.policy.lagSecondsMax;
    if (lag > max) violations.push({ region, lagSeconds: lag });
  }
  return { healthy: violations.length === 0, violations };
}

export function selectFailoverTarget(input: {
  policy: FailoverPolicyEval;
  regions: RegionCandidate[];
  consecutivePrimaryFailures: number;
  force?: boolean;
}): { action: "none" | "failover"; toRegionCode?: string; reason: string } {
  const primary = input.regions.find((r) => r.code === input.policy.primaryRegionCode);
  const primaryDown =
    !primary ||
    primary.status === RegionStatuses.offline ||
    primary.status === RegionStatuses.draining;

  if (!input.force && !primaryDown && input.consecutivePrimaryFailures < input.policy.healthFailThreshold) {
    return { action: "none", reason: "primary_healthy" };
  }

  if (!input.force && input.policy.mode === FailoverModes.manual && !primaryDown) {
    return { action: "none", reason: "manual_mode_requires_force" };
  }

  const standbys = input.policy.standbyRegions
    .map((code) => input.regions.find((r) => r.code === code))
    .filter((r): r is RegionCandidate => Boolean(r) && r!.status === RegionStatuses.active)
    .sort((a, b) => a.priority - b.priority || a.latencyWeight - b.latencyWeight);

  if (standbys.length === 0) {
    throw new AppError(503, "FAILOVER_UNAVAILABLE", "No healthy standby region");
  }

  return {
    action: "failover",
    toRegionCode: standbys[0]!.code,
    reason: primaryDown ? "primary_unavailable" : "forced_or_threshold",
  };
}

export function buildResidencyReport(input: {
  homeRegionCode: string;
  mode: string;
  allowedRegions: string[];
  lockedClasses: string[];
  activeRegionCodes: string[];
  replicationTargets: string[];
  primaryRegionCode: string;
  standbyRegions: string[];
}) {
  const allowedActive = input.allowedRegions.filter((c) =>
    input.activeRegionCodes.includes(c),
  );
  return {
    homeRegionCode: input.homeRegionCode,
    mode: input.mode,
    allowedRegions: input.allowedRegions,
    lockedClasses: input.lockedClasses,
    compliance: {
      homeActive: input.activeRegionCodes.includes(input.homeRegionCode),
      allowedCoverage:
        input.allowedRegions.length === 0
          ? 1
          : Number((allowedActive.length / input.allowedRegions.length).toFixed(2)),
      replicationAligned: input.replicationTargets.every((t) =>
        input.allowedRegions.length === 0
          ? true
          : input.allowedRegions.includes(t) || t === input.homeRegionCode,
      ),
      failoverAligned:
        input.allowedRegions.length === 0 ||
        (input.allowedRegions.includes(input.primaryRegionCode) &&
          input.standbyRegions.every((s) => input.allowedRegions.includes(s))),
    },
  };
}
