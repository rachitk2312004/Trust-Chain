import type { AnalyticsEvent } from "./developer.analytics.js";
import { aggregateErrorMetrics, aggregateLatencyMetrics } from "./developer.analytics.js";

function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\?.*$/, "")
    .slice(0, 200);
}

export type EndpointMetric = {
  method: string;
  path: string;
  requests: number;
  errors: number;
  errorRate: number;
  avgDurationMs: number | null;
  p95DurationMs: number | null;
};

export function buildEndpointMetrics(events: AnalyticsEvent[]): EndpointMetric[] {
  const map = new Map<
    string,
    { method: string; path: string; requests: number; errors: number; durations: number[] }
  >();

  for (const event of events) {
    const path = normalizePath(event.path);
    const key = `${event.method.toUpperCase()} ${path}`;
    const row = map.get(key) ?? {
      method: event.method.toUpperCase(),
      path,
      requests: 0,
      errors: 0,
      durations: [],
    };
    row.requests += 1;
    if (event.statusCode >= 400) row.errors += 1;
    if (typeof event.durationMs === "number") row.durations.push(event.durationMs);
    map.set(key, row);
  }

  return [...map.values()]
    .map((row) => {
      const sorted = [...row.durations].sort((a, b) => a - b);
      const p95Idx = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil(0.95 * sorted.length) - 1),
      );
      return {
        method: row.method,
        path: row.path,
        requests: row.requests,
        errors: row.errors,
        errorRate: row.requests === 0 ? 0 : Math.round((row.errors / row.requests) * 1000) / 1000,
        avgDurationMs:
          sorted.length === 0
            ? null
            : Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
        p95DurationMs: sorted.length === 0 ? null : sorted[p95Idx]!,
      };
    })
    .sort((a, b) => b.requests - a.requests);
}

export function buildMonitoringSnapshot(events: AnalyticsEvent[]) {
  const errors = aggregateErrorMetrics(events);
  const latency = aggregateLatencyMetrics(events);
  const endpoints = buildEndpointMetrics(events);

  const status =
    errors.errorRate >= 0.35 || (latency.p95Ms ?? 0) >= 5000
      ? "critical"
      : errors.errorRate >= 0.15 || (latency.p95Ms ?? 0) >= 2000
        ? "degraded"
        : "healthy";

  return {
    status,
    requests: events.length,
    errorRate: errors.errorRate,
    avgLatencyMs: latency.avgMs,
    p95LatencyMs: latency.p95Ms,
    topEndpoints: endpoints.slice(0, 10),
    failingEndpoints: endpoints
      .filter((e) => e.errors > 0)
      .sort((a, b) => b.errorRate - a.errorRate)
      .slice(0, 10),
  };
}
