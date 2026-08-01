import type { HealthMetrics } from "../types/extension.types.js";

const HEALTH_KEY = "tc_ext_health";

const empty: HealthMetrics = {
  scanAttempts: 0,
  scanSuccesses: 0,
  scanSuccessRate: 0,
  verificationCount: 0,
  verificationLatencyTotalMs: 0,
  verificationLatencyAvgMs: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheHitRatio: 0,
  networkFailures: 0,
};

function derive(
  m: Omit<HealthMetrics, "scanSuccessRate" | "verificationLatencyAvgMs" | "cacheHitRatio">,
): HealthMetrics {
  return {
    ...m,
    scanSuccessRate: m.scanAttempts === 0 ? 0 : m.scanSuccesses / m.scanAttempts,
    verificationLatencyAvgMs:
      m.verificationCount === 0 ? 0 : m.verificationLatencyTotalMs / m.verificationCount,
    cacheHitRatio:
      m.cacheHits + m.cacheMisses === 0 ? 0 : m.cacheHits / (m.cacheHits + m.cacheMisses),
  };
}

export async function getHealthMetrics(): Promise<HealthMetrics> {
  const stored = await chrome.storage.local.get(HEALTH_KEY);
  const raw = stored[HEALTH_KEY] as Partial<HealthMetrics> | undefined;
  return derive({
    scanAttempts: raw?.scanAttempts ?? 0,
    scanSuccesses: raw?.scanSuccesses ?? 0,
    verificationCount: raw?.verificationCount ?? 0,
    verificationLatencyTotalMs: raw?.verificationLatencyTotalMs ?? 0,
    cacheHits: raw?.cacheHits ?? 0,
    cacheMisses: raw?.cacheMisses ?? 0,
    networkFailures: raw?.networkFailures ?? 0,
  });
}

async function save(partial: Partial<HealthMetrics>): Promise<HealthMetrics> {
  const current = await getHealthMetrics();
  const next = derive({
    scanAttempts: partial.scanAttempts ?? current.scanAttempts,
    scanSuccesses: partial.scanSuccesses ?? current.scanSuccesses,
    verificationCount: partial.verificationCount ?? current.verificationCount,
    verificationLatencyTotalMs:
      partial.verificationLatencyTotalMs ?? current.verificationLatencyTotalMs,
    cacheHits: partial.cacheHits ?? current.cacheHits,
    cacheMisses: partial.cacheMisses ?? current.cacheMisses,
    networkFailures: partial.networkFailures ?? current.networkFailures,
  });
  await chrome.storage.local.set({ [HEALTH_KEY]: next });
  return next;
}

export async function recordScanAttempt(success: boolean): Promise<HealthMetrics> {
  const current = await getHealthMetrics();
  return save({
    scanAttempts: current.scanAttempts + 1,
    scanSuccesses: current.scanSuccesses + (success ? 1 : 0),
  });
}

export async function recordVerificationLatency(ms: number): Promise<HealthMetrics> {
  const current = await getHealthMetrics();
  return save({
    verificationCount: current.verificationCount + 1,
    verificationLatencyTotalMs: current.verificationLatencyTotalMs + Math.max(0, ms),
  });
}

export async function recordCacheHit(hit: boolean): Promise<HealthMetrics> {
  const current = await getHealthMetrics();
  return save({
    cacheHits: current.cacheHits + (hit ? 1 : 0),
    cacheMisses: current.cacheMisses + (hit ? 0 : 1),
  });
}

export async function recordNetworkFailure(): Promise<HealthMetrics> {
  const current = await getHealthMetrics();
  return save({ networkFailures: current.networkFailures + 1 });
}

export { empty as emptyHealthMetrics };
