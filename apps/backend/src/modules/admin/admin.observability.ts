/**
 * In-process administration platform observability counters.
 * Durable analytics come from AdminAuditLog / PolicyEvaluationEvent / TenantLifecycleEvent.
 */

export type AdminProcessMetricsSnapshot = {
  analyticsReads: number;
  operationsReprocess: number;
  operationsCleanup: number;
  retentionRuns: number;
  repairs: Record<string, number>;
  averageAnalyticsLatencyMs: number | null;
  averageOperationLatencyMs: number | null;
};

const LATENCY_RING_SIZE = 100;

export function averageLatency(samples: number[]): number | null {
  if (!samples.length) return null;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}

export class AdminProcessMetrics {
  private analyticsReads = 0;
  private operationsReprocess = 0;
  private operationsCleanup = 0;
  private retentionRuns = 0;
  private repairs: Record<string, number> = {};
  private analyticsLatency: number[] = [];
  private operationLatency: number[] = [];

  recordAnalyticsRead(latencyMs?: number): void {
    this.analyticsReads += 1;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.analyticsLatency.push(latencyMs);
      if (this.analyticsLatency.length > LATENCY_RING_SIZE) this.analyticsLatency.shift();
    }
  }

  recordReprocess(latencyMs?: number): void {
    this.operationsReprocess += 1;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.operationLatency.push(latencyMs);
      if (this.operationLatency.length > LATENCY_RING_SIZE) this.operationLatency.shift();
    }
  }

  recordCleanup(latencyMs?: number): void {
    this.operationsCleanup += 1;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.operationLatency.push(latencyMs);
      if (this.operationLatency.length > LATENCY_RING_SIZE) this.operationLatency.shift();
    }
  }

  recordRetention(): void {
    this.retentionRuns += 1;
  }

  recordRepair(target: string): void {
    this.repairs[target] = (this.repairs[target] ?? 0) + 1;
  }

  snapshot(): AdminProcessMetricsSnapshot {
    return {
      analyticsReads: this.analyticsReads,
      operationsReprocess: this.operationsReprocess,
      operationsCleanup: this.operationsCleanup,
      retentionRuns: this.retentionRuns,
      repairs: { ...this.repairs },
      averageAnalyticsLatencyMs: averageLatency(this.analyticsLatency),
      averageOperationLatencyMs: averageLatency(this.operationLatency),
    };
  }

  reset(): void {
    this.analyticsReads = 0;
    this.operationsReprocess = 0;
    this.operationsCleanup = 0;
    this.retentionRuns = 0;
    this.repairs = {};
    this.analyticsLatency = [];
    this.operationLatency = [];
  }
}

export const adminProcessMetrics = new AdminProcessMetrics();
