import { Badge, FormHint } from "@trustchain/ui";
import type { PlatformReadinessReport } from "../../services/platformApi";

export function ReadinessReportCard({ report }: { report: PlatformReadinessReport }) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Readiness report
        </h3>
        <Badge
          tone={
            report.status === "ready"
              ? "success"
              : report.status === "not_ready"
                ? "danger"
                : "neutral"
          }
        >
          {report.status}
        </Badge>
      </div>
      <p className="mb-2 font-mono text-sm">
        score {report.score.toFixed(3)} · health {report.healthStatus}
      </p>
      <p className="mb-3 text-xs text-[var(--tc-muted)]">
        {new Date(report.createdAt).toLocaleString()} · {report.id}
      </p>
      {report.blockers.length === 0 ? (
        <FormHint>No readiness blockers.</FormHint>
      ) : (
        <ul className="list-inside list-disc text-sm">
          {report.blockers.map((b) => (
            <li key={b} className="font-mono text-xs">
              {b}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
