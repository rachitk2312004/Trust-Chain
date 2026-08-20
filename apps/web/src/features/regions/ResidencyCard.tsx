import { Badge } from "@trustchain/ui";
import type { ResidencyReport } from "../../services/regionApi";

export function ResidencyCard({ report }: { report: ResidencyReport }) {
  const c = report.report.compliance;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Home region</div>
        <div className="mt-1 font-mono text-xl font-semibold">{report.report.homeRegionCode}</div>
        <div className="mt-2">
          <Badge tone="neutral">{report.report.mode}</Badge>
        </div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Home active</div>
        <div className="mt-2">
          <Badge tone={c.homeActive ? "success" : "danger"}>
            {c.homeActive ? "yes" : "no"}
          </Badge>
        </div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Allowed coverage</div>
        <div className="mt-1 text-3xl font-semibold">{Math.round(c.allowedCoverage * 100)}%</div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Alignment</div>
        <p className="mt-2 text-xs">
          replication{" "}
          <Badge tone={c.replicationAligned ? "success" : "danger"}>
            {c.replicationAligned ? "ok" : "drift"}
          </Badge>
        </p>
        <p className="mt-1 text-xs">
          failover{" "}
          <Badge tone={c.failoverAligned ? "success" : "danger"}>
            {c.failoverAligned ? "ok" : "drift"}
          </Badge>
        </p>
      </div>
    </div>
  );
}
