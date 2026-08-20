type UsagePoint = {
  bucket: string;
  requests: number;
  success: number;
  clientError: number;
  serverError: number;
};

export function UsageChart({ series }: { series: UsagePoint[] }) {
  if (series.length === 0) {
    return <p className="text-sm text-[var(--tc-muted)]">No usage series yet.</p>;
  }

  const max = Math.max(1, ...series.map((p) => p.requests));

  return (
    <div className="space-y-3">
      <div className="flex h-40 items-end gap-1">
        {series.map((point) => (
          <div key={point.bucket} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-[var(--tc-accent)]/80"
              style={{ height: `${Math.max(4, (point.requests / max) * 100)}%` }}
              title={`${point.bucket}: ${point.requests} requests`}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--tc-muted)]">
        <span>{series[0]?.bucket}</span>
        <span>{series[series.length - 1]?.bucket}</span>
      </div>
    </div>
  );
}
