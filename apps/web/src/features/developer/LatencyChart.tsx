type LatencyPoint = {
  path: string;
  samples: number;
  avgMs: number;
  p95Ms: number | null;
};

export function LatencyChart({
  avgMs,
  p50Ms,
  p95Ms,
  p99Ms,
  byPath = [],
}: {
  avgMs: number | null;
  p50Ms?: number | null;
  p95Ms: number | null;
  p99Ms?: number | null;
  byPath?: LatencyPoint[];
}) {
  const bars = [
    { label: "avg", value: avgMs },
    { label: "p50", value: p50Ms ?? null },
    { label: "p95", value: p95Ms },
    { label: "p99", value: p99Ms ?? null },
  ].filter((b) => b.value != null) as Array<{ label: string; value: number }>;

  if (bars.length === 0) {
    return <p className="text-sm text-[var(--tc-muted)]">No latency samples yet.</p>;
  }

  const max = Math.max(1, ...bars.map((b) => b.value));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        {bars.map((bar) => (
          <div key={bar.label}>
            <div className="mb-1 flex justify-between text-xs text-[var(--tc-muted)]">
              <span className="uppercase">{bar.label}</span>
              <span>{bar.value}ms</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-[var(--tc-border)]">
              <div
                className="h-full bg-[var(--tc-accent)]"
                style={{ width: `${(bar.value / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {byPath.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {byPath.slice(0, 8).map((row) => (
            <li key={row.path} className="flex justify-between gap-3">
              <span className="truncate font-mono text-xs">{row.path}</span>
              <span className="shrink-0 text-[var(--tc-muted)]">
                p95 {row.p95Ms ?? "—"}ms · n={row.samples}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
