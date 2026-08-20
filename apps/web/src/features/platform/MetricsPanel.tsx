import { FormHint } from "@trustchain/ui";
import type { PlatformMetrics } from "../../services/platformApi";

export function MetricsPanel({
  metrics,
  tracing,
}: {
  metrics: PlatformMetrics;
  tracing: PlatformMetrics["tracing"];
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-[var(--tc-border)] p-3">
          <div className="text-xs text-[var(--tc-muted)]">Health</div>
          <div className="font-mono text-lg">{metrics.healthStatus}</div>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-3">
          <div className="text-xs text-[var(--tc-muted)]">Readiness</div>
          <div className="font-mono text-lg">{metrics.readinessStatus}</div>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-3">
          <div className="text-xs text-[var(--tc-muted)]">Dependency score</div>
          <div className="font-mono text-lg">{metrics.dependencyScore.toFixed(3)}</div>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-3">
          <div className="text-xs text-[var(--tc-muted)]">Rate-limit backend</div>
          <div className="font-mono text-lg">{metrics.rateLimit.backend}</div>
        </div>
      </div>

      <div className="rounded border border-[var(--tc-border)] p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Feature flags
        </h3>
        <p className="font-mono text-sm">
          {metrics.featureFlags.active}/{metrics.featureFlags.total} active ·{" "}
          {metrics.featureFlags.killSwitched} kill-switched
        </p>
        <p className="mt-1 text-xs text-[var(--tc-muted)]">
          Rate limit {metrics.rateLimit.maxRequests}/{metrics.rateLimit.windowMs}ms
        </p>
      </div>

      <div className="rounded border border-[var(--tc-border)] p-4">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Tracing ({tracing.windowKey})
        </h3>
        {tracing.spanCount === 0 ? (
          <FormHint>No recent spans in the in-process ring yet.</FormHint>
        ) : (
          <div className="space-y-1 font-mono text-sm">
            <div>
              spans {tracing.spanCount} · errors {tracing.errorCount} (
              {(tracing.errorRate * 100).toFixed(1)}%)
            </div>
            <div>
              p50 {tracing.p50LatencyMs}ms · p95 {tracing.p95LatencyMs}ms
            </div>
            {Object.entries(tracing.services).map(([svc, s]) => (
              <div key={svc} className="text-xs text-[var(--tc-muted)]">
                {svc}: {s.count} spans · {s.errors} errors · avg {s.avgMs}ms
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
