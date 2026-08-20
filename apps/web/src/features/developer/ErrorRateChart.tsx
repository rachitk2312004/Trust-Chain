import { Badge } from "@trustchain/ui";

type StatusCount = { statusCode: number; count: number };
type PathError = { path: string; errors: number; total: number; errorRate: number };

export function ErrorRateChart({
  errorRate,
  errors,
  totalRequests,
  byStatus = [],
  byPath = [],
}: {
  errorRate: number;
  errors: number;
  totalRequests: number;
  byStatus?: StatusCount[];
  byPath?: PathError[];
}) {
  const pct = Math.round(errorRate * 1000) / 10;
  const tone = errorRate >= 0.35 ? "danger" : errorRate >= 0.15 ? "warning" : "success";

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="text-3xl font-semibold">{pct}%</div>
        <Badge tone={tone}>{errors} / {totalRequests} errors</Badge>
      </div>
      <div className="h-2 overflow-hidden rounded bg-[var(--tc-border)]">
        <div
          className={
            tone === "danger"
              ? "h-full bg-red-600"
              : tone === "warning"
                ? "h-full bg-amber-500"
                : "h-full bg-emerald-600"
          }
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {byStatus.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {byStatus.map((row) => (
            <Badge key={row.statusCode} tone={row.statusCode >= 500 ? "danger" : "warning"}>
              {row.statusCode}: {row.count}
            </Badge>
          ))}
        </div>
      ) : null}
      {byPath.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {byPath.slice(0, 8).map((row) => (
            <li key={row.path} className="flex justify-between gap-3">
              <span className="truncate font-mono text-xs">{row.path}</span>
              <span className="shrink-0 text-[var(--tc-muted)]">
                {(row.errorRate * 100).toFixed(1)}% · {row.errors}/{row.total}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
