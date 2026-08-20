import { DeveloperAnomalyThresholds } from "@trustchain/config";
import type { AnalyticsEvent } from "./developer.analytics.js";
import { aggregateErrorMetrics, aggregateLatencyMetrics, aggregateUsageSeries } from "./developer.analytics.js";

export type AnomalySeverity = "info" | "warn" | "critical";

export type AnomalyFinding = {
  id: string;
  type: "error_rate" | "latency" | "volume_spike";
  severity: AnomalySeverity;
  message: string;
  value: number;
  threshold: number;
  meta?: Record<string, unknown>;
};

export function detectAnomalies(
  events: AnalyticsEvent[],
  thresholds = DeveloperAnomalyThresholds,
): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  if (events.length < thresholds.minSamplesForAnomaly) {
    return findings;
  }

  const errors = aggregateErrorMetrics(events);
  if (errors.errorRate >= thresholds.errorRateCritical) {
    findings.push({
      id: "error_rate_critical",
      type: "error_rate",
      severity: "critical",
      message: `Error rate ${(errors.errorRate * 100).toFixed(1)}% exceeds critical threshold`,
      value: errors.errorRate,
      threshold: thresholds.errorRateCritical,
    });
  } else if (errors.errorRate >= thresholds.errorRateWarn) {
    findings.push({
      id: "error_rate_warn",
      type: "error_rate",
      severity: "warn",
      message: `Error rate ${(errors.errorRate * 100).toFixed(1)}% exceeds warning threshold`,
      value: errors.errorRate,
      threshold: thresholds.errorRateWarn,
    });
  }

  const latency = aggregateLatencyMetrics(events);
  if ((latency.p95Ms ?? 0) >= thresholds.latencyP95CriticalMs) {
    findings.push({
      id: "latency_critical",
      type: "latency",
      severity: "critical",
      message: `p95 latency ${latency.p95Ms}ms exceeds critical threshold`,
      value: latency.p95Ms ?? 0,
      threshold: thresholds.latencyP95CriticalMs,
    });
  } else if ((latency.p95Ms ?? 0) >= thresholds.latencyP95WarnMs) {
    findings.push({
      id: "latency_warn",
      type: "latency",
      severity: "warn",
      message: `p95 latency ${latency.p95Ms}ms exceeds warning threshold`,
      value: latency.p95Ms ?? 0,
      threshold: thresholds.latencyP95WarnMs,
    });
  }

  const series = aggregateUsageSeries(events);
  if (series.length >= 3) {
    const latest = series[series.length - 1]!;
    const baseline = series.slice(0, -1);
    const avg =
      baseline.reduce((sum, row) => sum + row.requests, 0) / Math.max(1, baseline.length);
    if (avg > 0 && latest.requests >= avg * thresholds.volumeSpikeMultiplier) {
      findings.push({
        id: "volume_spike",
        type: "volume_spike",
        severity: "warn",
        message: `Request volume spike: ${latest.requests} vs baseline avg ${Math.round(avg)}`,
        value: latest.requests,
        threshold: avg * thresholds.volumeSpikeMultiplier,
        meta: { bucket: latest.bucket, baselineAvg: Math.round(avg) },
      });
    }
  }

  return findings;
}
