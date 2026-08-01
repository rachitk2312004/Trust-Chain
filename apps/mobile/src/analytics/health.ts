import { mmkv } from "../cache/mmkv";
import type { HealthMetrics } from "../types/mobile.types";
import { getQueueDepth } from "../sync/queue";

const HEALTH_KEY = "tc.mobile.health";

const empty = (): HealthMetrics => ({
  syncLatencyMs: 0,
  verificationLatencyMs: 0,
  cacheHitRatio: 0,
  queueDepth: 0,
  networkFailures: 0,
  batteryImpact: 0,
  syncSamples: 0,
  verificationSamples: 0,
  cacheHits: 0,
  cacheMisses: 0,
});

function derive(m: HealthMetrics): HealthMetrics {
  const total = m.cacheHits + m.cacheMisses;
  return {
    ...m,
    cacheHitRatio: total === 0 ? 0 : m.cacheHits / total,
    batteryImpact: Math.min(
      100,
      m.networkFailures * 2 + m.syncSamples * 0.5 + m.verificationSamples * 0.3,
    ),
  };
}

export async function getHealthMetrics(): Promise<HealthMetrics> {
  const raw = await mmkv.getString(HEALTH_KEY);
  const base = raw
    ? ({ ...empty(), ...(JSON.parse(raw) as HealthMetrics) } as HealthMetrics)
    : empty();
  base.queueDepth = await getQueueDepth();
  return derive(base);
}

async function save(partial: Partial<HealthMetrics>): Promise<HealthMetrics> {
  const current = await getHealthMetrics();
  const next = derive({ ...current, ...partial, queueDepth: await getQueueDepth() });
  await mmkv.set(HEALTH_KEY, JSON.stringify(next));
  return next;
}

export async function recordSyncLatency(ms: number): Promise<void> {
  const current = await getHealthMetrics();
  const syncSamples = current.syncSamples + 1;
  const syncLatencyMs = (current.syncLatencyMs * current.syncSamples + ms) / syncSamples;
  await save({ syncSamples, syncLatencyMs });
}

export async function recordVerificationLatency(ms: number): Promise<void> {
  const current = await getHealthMetrics();
  const verificationSamples = current.verificationSamples + 1;
  const verificationLatencyMs =
    (current.verificationLatencyMs * current.verificationSamples + ms) / verificationSamples;
  await save({ verificationSamples, verificationLatencyMs });
}

export async function recordCacheHit(hit: boolean): Promise<void> {
  const current = await getHealthMetrics();
  await save({
    cacheHits: current.cacheHits + (hit ? 1 : 0),
    cacheMisses: current.cacheMisses + (hit ? 0 : 1),
  });
}

export async function recordNetworkFailure(): Promise<void> {
  const current = await getHealthMetrics();
  await save({ networkFailures: current.networkFailures + 1 });
}
