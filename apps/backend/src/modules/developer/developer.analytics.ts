export type AnalyticsEvent = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number | null;
  createdAt: string | Date;
  apiKeyId?: string | null;
};

export type TimeBucket = {
  bucket: string;
  requests: number;
  success: number;
  clientError: number;
  serverError: number;
  avgDurationMs: number | null;
};

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizePath(path: string): string {
  return path
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\?.*$/, "")
    .slice(0, 200);
}

export function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

export function aggregateUsageSeries(events: AnalyticsEvent[]): TimeBucket[] {
  const map = new Map<
    string,
    { requests: number; success: number; clientError: number; serverError: number; durations: number[] }
  >();

  for (const event of events) {
    const key = dayKey(toDate(event.createdAt));
    const row = map.get(key) ?? {
      requests: 0,
      success: 0,
      clientError: 0,
      serverError: 0,
      durations: [],
    };
    row.requests += 1;
    if (event.statusCode >= 200 && event.statusCode < 300) row.success += 1;
    else if (event.statusCode >= 400 && event.statusCode < 500) row.clientError += 1;
    else if (event.statusCode >= 500) row.serverError += 1;
    if (typeof event.durationMs === "number") row.durations.push(event.durationMs);
    map.set(key, row);
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, row]) => ({
      bucket,
      requests: row.requests,
      success: row.success,
      clientError: row.clientError,
      serverError: row.serverError,
      avgDurationMs:
        row.durations.length > 0
          ? Math.round(row.durations.reduce((a, b) => a + b, 0) / row.durations.length)
          : null,
    }));
}

export function aggregateErrorMetrics(events: AnalyticsEvent[]) {
  const byStatus = new Map<number, number>();
  const byPath = new Map<string, { errors: number; total: number }>();
  let errors = 0;

  for (const event of events) {
    const path = normalizePath(event.path);
    const pathRow = byPath.get(path) ?? { errors: 0, total: 0 };
    pathRow.total += 1;
    if (event.statusCode >= 400) {
      errors += 1;
      byStatus.set(event.statusCode, (byStatus.get(event.statusCode) ?? 0) + 1);
      pathRow.errors += 1;
    }
    byPath.set(path, pathRow);
  }

  return {
    totalRequests: events.length,
    errors,
    errorRate: events.length === 0 ? 0 : Math.round((errors / events.length) * 1000) / 1000,
    byStatus: [...byStatus.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([statusCode, count]) => ({ statusCode, count })),
    byPath: [...byPath.entries()]
      .map(([path, row]) => ({
        path,
        errors: row.errors,
        total: row.total,
        errorRate: row.total === 0 ? 0 : Math.round((row.errors / row.total) * 1000) / 1000,
      }))
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 20),
  };
}

export function aggregateLatencyMetrics(events: AnalyticsEvent[]) {
  const durations = events
    .map((e) => e.durationMs)
    .filter((d): d is number => typeof d === "number" && Number.isFinite(d))
    .sort((a, b) => a - b);

  const byPath = new Map<string, number[]>();
  for (const event of events) {
    if (typeof event.durationMs !== "number") continue;
    const path = normalizePath(event.path);
    const list = byPath.get(path) ?? [];
    list.push(event.durationMs);
    byPath.set(path, list);
  }

  return {
    samples: durations.length,
    avgMs:
      durations.length === 0
        ? null
        : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    p50Ms: percentile(durations, 50),
    p95Ms: percentile(durations, 95),
    p99Ms: percentile(durations, 99),
    maxMs: durations.length === 0 ? null : durations[durations.length - 1]!,
    byPath: [...byPath.entries()]
      .map(([path, values]) => {
        const sorted = [...values].sort((a, b) => a - b);
        return {
          path,
          samples: sorted.length,
          avgMs: Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
          p95Ms: percentile(sorted, 95),
        };
      })
      .sort((a, b) => (b.p95Ms ?? 0) - (a.p95Ms ?? 0))
      .slice(0, 20),
  };
}

export function buildAnalyticsDashboard(events: AnalyticsEvent[]) {
  const usage = aggregateUsageSeries(events);
  const errors = aggregateErrorMetrics(events);
  const latency = aggregateLatencyMetrics(events);
  const total = events.length;
  const success = events.filter((e) => e.statusCode >= 200 && e.statusCode < 300).length;

  return {
    totals: {
      requests: total,
      success,
      errors: errors.errors,
      errorRate: errors.errorRate,
      avgDurationMs: latency.avgMs,
      p95DurationMs: latency.p95Ms,
    },
    usage,
    errors,
    latency,
  };
}

export async function loadAnalyticsEvents(
  organizationId: string,
  days: number,
): Promise<AnalyticsEvent[]> {
  const { prisma } = await import("@trustchain/database");
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.apiUsageEvent.findMany({
    where: { organizationId, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
    take: 10_000,
  });
  return rows.map((row) => ({
    method: row.method,
    path: row.path,
    statusCode: row.statusCode,
    durationMs: row.durationMs,
    createdAt: row.createdAt,
    apiKeyId: row.apiKeyId,
  }));
}

export async function getDeveloperAnalyticsOverview(organizationId: string, days: number) {
  const { buildEndpointMetrics, buildMonitoringSnapshot } = await import(
    "./developer.monitoring.js"
  );
  const events = await loadAnalyticsEvents(organizationId, days);
  const dashboard = buildAnalyticsDashboard(events);
  const monitoring = buildMonitoringSnapshot(events);
  return {
    organizationId,
    days,
    generatedAt: new Date().toISOString(),
    ...dashboard,
    monitoring,
    endpoints: buildEndpointMetrics(events).slice(0, 25),
  };
}

export async function getDeveloperUsageAnalytics(organizationId: string, days: number) {
  const events = await loadAnalyticsEvents(organizationId, days);
  return {
    organizationId,
    days,
    series: aggregateUsageSeries(events),
    totals: buildAnalyticsDashboard(events).totals,
  };
}

export async function getDeveloperErrorAnalytics(organizationId: string, days: number) {
  const events = await loadAnalyticsEvents(organizationId, days);
  return {
    organizationId,
    days,
    ...aggregateErrorMetrics(events),
  };
}

export async function getDeveloperLatencyAnalytics(organizationId: string, days: number) {
  const events = await loadAnalyticsEvents(organizationId, days);
  return {
    organizationId,
    days,
    ...aggregateLatencyMetrics(events),
  };
}
