import { Badge } from "@trustchain/ui";

export function ComplianceScoreCard({
  label,
  score,
  grade,
  subtitle,
}: {
  label: string;
  score: number;
  grade?: string;
  subtitle?: string;
}) {
  const pct = Math.round(score * 1000) / 10;
  const tone =
    score >= 0.8 ? "success" : score >= 0.6 ? "warning" : ("danger" as const);

  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">{label}</div>
        {grade ? <Badge tone={tone}>{grade}</Badge> : null}
      </div>
      <div className="text-3xl font-semibold">{pct}%</div>
      <div className="mt-3 h-2 overflow-hidden rounded bg-[var(--tc-border)]">
        <div
          className={
            tone === "success"
              ? "h-full bg-emerald-600"
              : tone === "warning"
                ? "h-full bg-amber-500"
                : "h-full bg-red-600"
          }
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      {subtitle ? <p className="mt-2 text-xs text-[var(--tc-muted)]">{subtitle}</p> : null}
    </div>
  );
}
