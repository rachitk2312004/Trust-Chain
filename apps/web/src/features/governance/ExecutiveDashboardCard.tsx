import { Badge } from "@trustchain/ui";
import type { GovernanceDashboard } from "../../services/governanceApi";

export function ExecutiveDashboardCard({
  executive,
  riskPortfolio,
  frameworksEnabled,
}: {
  executive: GovernanceDashboard["executive"];
  riskPortfolio: GovernanceDashboard["riskPortfolio"];
  frameworksEnabled: number;
}) {
  const scorePct = Math.round(executive.summary.score * 100);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
          Executive score
        </div>
        <div className="mt-1 text-3xl font-semibold">{scorePct}%</div>
        <div className="mt-2">
          <Badge
            tone={
              executive.summary.grade === "strong"
                ? "success"
                : executive.summary.grade === "critical"
                  ? "danger"
                  : "neutral"
            }
          >
            {executive.summary.grade}
          </Badge>
        </div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
          Frameworks active
        </div>
        <div className="mt-1 text-3xl font-semibold">{frameworksEnabled}</div>
        <p className="mt-1 text-xs text-[var(--tc-muted)]">of 6 supported</p>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
          Risk portfolio
        </div>
        <div className="mt-1 text-3xl font-semibold">
          {Math.round(riskPortfolio.portfolioScore * 100)}%
        </div>
        <p className="mt-1 text-xs text-[var(--tc-muted)]">
          {riskPortfolio.openCount} open · {riskPortfolio.criticalCount} critical
        </p>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Highlights</div>
        <ul className="mt-2 space-y-1 text-xs">
          {executive.summary.highlights.map((h) => (
            <li key={h}>· {h}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
