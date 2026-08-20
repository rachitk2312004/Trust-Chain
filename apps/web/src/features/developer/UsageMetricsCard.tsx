import { Badge, FormHint } from "@trustchain/ui";

export type UsageMetrics = {
  organizationId: string;
  windowStart: string | null;
  totals: {
    requests: number;
    success: number;
    clientError: number;
    serverError: number;
    avgDurationMs: number | null;
  };
  byMethod: Array<{ method: string; count: number }>;
};

export function UsageMetricsCard({ metrics }: { metrics?: UsageMetrics | null }) {
  if (!metrics) {
    return <FormHint>No usage metrics yet.</FormHint>;
  }

  const { totals, byMethod } = metrics;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Requests" value={String(totals.requests)} />
      <Metric label="Success (2xx)" value={String(totals.success)} tone="success" />
      <Metric label="Client errors" value={String(totals.clientError)} tone="warning" />
      <Metric label="Server errors" value={String(totals.serverError)} tone="danger" />
      <div className="sm:col-span-2 lg:col-span-4">
        <div className="mb-2 text-sm font-medium">By method</div>
        {byMethod.length === 0 ? (
          <FormHint>No method breakdown.</FormHint>
        ) : (
          <div className="flex flex-wrap gap-2">
            {byMethod.map((row) => (
              <Badge key={row.method} tone="neutral">
                {row.method}: {row.count}
              </Badge>
            ))}
          </div>
        )}
        {totals.avgDurationMs != null ? (
          <p className="mt-2 text-xs text-[var(--tc-muted)]">
            Avg latency {totals.avgDurationMs}ms
            {metrics.windowStart
              ? ` · since ${new Date(metrics.windowStart).toLocaleString()}`
              : ""}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="text-2xl font-semibold">{value}</span>
        <Badge tone={tone}>{label.split(" ")[0]}</Badge>
      </div>
    </div>
  );
}
