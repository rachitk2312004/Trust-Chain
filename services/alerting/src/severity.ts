import type { Severity } from "../../shared/types.js";

const SEVERITY_RANK: Record<Severity, number> = {
  info: 0,
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

export function rankSeverity(a: Severity, b: Severity): number {
  return SEVERITY_RANK[b] - SEVERITY_RANK[a];
}

export function maxSeverity(severities: Severity[]): Severity {
  return severities.reduce(
    (current, candidate) => (rankSeverity(current, candidate) > 0 ? candidate : current),
    "info" as Severity,
  );
}

export { type Severity };
