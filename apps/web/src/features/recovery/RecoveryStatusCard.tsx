import { Badge } from "@trustchain/ui";
import type { RecoveryStatus } from "../../services/recoveryApi";

export function RecoveryStatusCard({ status }: { status: RecoveryStatus }) {
  const obj = status.objectives;
  const scorePct = Math.round(status.continuity.score * 100);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Continuity</div>
        <div className="mt-1 text-3xl font-semibold">{scorePct}%</div>
        <div className="mt-2">
          <Badge tone={scorePct >= 80 ? "success" : scorePct >= 50 ? "neutral" : "danger"}>
            score
          </Badge>
        </div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">RPO</div>
        {obj ? (
          <>
            <div className="mt-1 font-mono text-xl font-semibold">
              {obj.achievedRpoMinutes ?? "—"}m / {obj.rpoMinutes}m
            </div>
            <div className="mt-2">
              <Badge tone={obj.rpoMet ? "success" : "danger"}>
                {obj.rpoMet ? "within target" : "breach"}
              </Badge>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm text-[var(--tc-muted)]">No policy</p>
        )}
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">RTO target</div>
        <div className="mt-1 font-mono text-xl font-semibold">
          {obj ? `${obj.rtoMinutes}m` : "—"}
        </div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Activity</div>
        <p className="mt-2 text-xs">
          policies <span className="font-mono">{status.counts.policies}</span>
        </p>
        <p className="mt-1 text-xs">
          backups <span className="font-mono">{status.counts.backups}</span> · restores{" "}
          <span className="font-mono">{status.counts.restores}</span>
        </p>
        <p className="mt-1 text-xs">
          failbacks <span className="font-mono">{status.counts.failbacks}</span>
        </p>
      </div>
    </div>
  );
}
