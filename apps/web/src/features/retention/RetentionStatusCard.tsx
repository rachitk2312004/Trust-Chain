import { Badge } from "@trustchain/ui";
import type { RetentionStatus } from "../../services/retentionApi";

export function RetentionStatusCard({ status }: { status: RetentionStatus }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Active policies</div>
        <div className="mt-1 text-3xl font-semibold">{status.activePolicies}</div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Active holds</div>
        <div className="mt-1 text-3xl font-semibold">{status.activeHolds}</div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Archives</div>
        <div className="mt-1 text-3xl font-semibold">{status.archives.archived}</div>
        <p className="mt-1 text-xs text-[var(--tc-muted)]">
          purged {status.archives.purged} · blocked {status.archives.holdBlocked}
        </p>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Custody chain</div>
        <div className="mt-2">
          <Badge tone={status.chainValid ? "success" : "danger"}>
            {status.chainValid ? "intact" : "broken"}
          </Badge>
        </div>
        {status.latestRun ? (
          <p className="mt-2 text-xs text-[var(--tc-muted)]">
            Last run {status.latestRun.status}
            {status.latestRun.dryRun ? " (dry)" : ""} ·{" "}
            {new Date(status.latestRun.createdAt).toLocaleString()}
          </p>
        ) : (
          <p className="mt-2 text-xs text-[var(--tc-muted)]">No runs yet</p>
        )}
      </div>
    </div>
  );
}
