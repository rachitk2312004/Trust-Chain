import { Badge, Button } from "@trustchain/ui";
import type { WalletDashboard } from "../../services/walletApi";

export function WalletSyncCard({
  report,
  recentSyncJobs,
  onSync,
  syncPending,
  canSync,
}: {
  report: WalletDashboard["report"];
  recentSyncJobs: WalletDashboard["recentSyncJobs"];
  onSync: () => void;
  syncPending?: boolean;
  canSync?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Health</div>
        <div className="mt-1 text-3xl font-semibold">
          {Math.round(report.healthScore * 100)}%
        </div>
        <div className="mt-2">
          <Badge tone={report.healthScore >= 0.7 ? "success" : "neutral"}>ownership</Badge>
        </div>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Wallets</div>
        <div className="mt-1 text-3xl font-semibold">{report.total}</div>
        <p className="mt-1 text-xs text-[var(--tc-muted)]">
          {report.verified} verified · {report.pending} pending · {report.conflicted} conflict
        </p>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Providers</div>
        <ul className="mt-2 space-y-1 text-xs">
          {Object.entries(report.providers).length === 0 ? (
            <li className="text-[var(--tc-muted)]">None linked</li>
          ) : (
            Object.entries(report.providers).map(([p, n]) => (
              <li key={p}>
                <span className="font-mono">{p}</span> · {n}
              </li>
            ))
          )}
        </ul>
      </div>
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Sync</div>
        <p className="mt-2 text-xs text-[var(--tc-muted)]">
          {recentSyncJobs[0]
            ? `Last job ${recentSyncJobs[0].status}`
            : "No sync jobs yet"}
        </p>
        {canSync ? (
          <div className="mt-3">
            <Button type="button" disabled={syncPending} onClick={onSync}>
              {syncPending ? "Syncing…" : "Run sync"}
            </Button>
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--tc-muted)]">Org admin required to sync</p>
        )}
      </div>
    </div>
  );
}
