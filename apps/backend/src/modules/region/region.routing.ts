import { RegionStatuses, RoutingStrategies } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type RegionCandidate = {
  code: string;
  status: string;
  priority: number;
  latencyWeight: number;
  jurisdiction: string;
};

export type ResidencyPolicyEval = {
  homeRegionCode: string;
  mode: string;
  allowedRegions: string[];
  lockedClasses: string[];
};

export type RoutingPolicyEval = {
  strategy: string;
  stickyTtlSeconds: number;
};

/**
 * Select an eligible region given residency + routing strategy.
 */
export function selectRegion(input: {
  regions: RegionCandidate[];
  residency: ResidencyPolicyEval;
  routing: RoutingPolicyEval;
  clientRegionHint?: string | null;
  stickyRegion?: string | null;
  dataClass?: string | null;
}): { regionCode: string; reason: string } {
  const active = input.regions.filter((r) => r.status === RegionStatuses.active);
  if (active.length === 0) {
    throw new AppError(503, "NO_ACTIVE_REGION", "No active regions available");
  }

  const allowed = new Set(
    input.residency.mode === "unrestricted"
      ? active.map((r) => r.code)
      : input.residency.allowedRegions.length
        ? input.residency.allowedRegions
        : [input.residency.homeRegionCode],
  );

  // Locked data classes must stay in home under strict/preferred
  if (
    input.dataClass &&
    input.residency.lockedClasses.includes(input.dataClass) &&
    input.residency.mode !== "unrestricted"
  ) {
    const home = active.find((r) => r.code === input.residency.homeRegionCode);
    if (!home || !allowed.has(home.code)) {
      throw new AppError(403, "RESIDENCY_VIOLATION", "Locked data class cannot leave home region");
    }
    return { regionCode: home.code, reason: "locked_class_home" };
  }

  const eligible = active.filter((r) => allowed.has(r.code));
  if (eligible.length === 0) {
    throw new AppError(403, "RESIDENCY_VIOLATION", "No eligible region under residency policy");
  }

  if (input.routing.strategy === RoutingStrategies.home) {
    const home = eligible.find((r) => r.code === input.residency.homeRegionCode);
    if (home) return { regionCode: home.code, reason: "home_strategy" };
  }

  if (
    input.routing.strategy === RoutingStrategies.sticky &&
    input.stickyRegion &&
    eligible.some((r) => r.code === input.stickyRegion)
  ) {
    return { regionCode: input.stickyRegion, reason: "sticky_session" };
  }

  if (
    (input.routing.strategy === RoutingStrategies.nearest ||
      input.routing.strategy === RoutingStrategies.latency) &&
    input.clientRegionHint
  ) {
    const hinted = eligible.find((r) => r.code === input.clientRegionHint);
    if (hinted) return { regionCode: hinted.code, reason: "client_hint" };
  }

  // latency / nearest fallback: lowest latencyWeight then priority
  const sorted = [...eligible].sort(
    (a, b) => a.latencyWeight - b.latencyWeight || a.priority - b.priority,
  );
  return { regionCode: sorted[0]!.code, reason: "latency_priority" };
}

export function enforceResidency(input: {
  residency: ResidencyPolicyEval;
  targetRegionCode: string;
  dataClass?: string | null;
}): { allowed: boolean; reason: string } {
  if (input.residency.mode === "unrestricted") {
    return { allowed: true, reason: "unrestricted" };
  }

  const allowed = new Set(
    input.residency.allowedRegions.length
      ? input.residency.allowedRegions
      : [input.residency.homeRegionCode],
  );

  if (
    input.dataClass &&
    input.residency.lockedClasses.includes(input.dataClass) &&
    input.targetRegionCode !== input.residency.homeRegionCode
  ) {
    return { allowed: false, reason: "locked_class" };
  }

  if (!allowed.has(input.targetRegionCode)) {
    return { allowed: false, reason: "region_not_allowed" };
  }

  if (
    input.residency.mode === "strict" &&
    input.targetRegionCode !== input.residency.homeRegionCode &&
    input.dataClass &&
    input.residency.lockedClasses.includes(input.dataClass)
  ) {
    return { allowed: false, reason: "strict_home_only" };
  }

  return { allowed: true, reason: "ok" };
}
