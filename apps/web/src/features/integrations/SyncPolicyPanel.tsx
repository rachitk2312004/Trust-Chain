import { Badge, Button, FormHint } from "@trustchain/ui";
import type { EcosystemIntegration, IntegrationDashboard } from "../../services/integrationApi";

export function SyncPolicyPanel({
  dashboard,
  selected,
  recentSyncJobs,
  onSyncAll,
  syncPending,
}: {
  dashboard: IntegrationDashboard["dashboard"];
  selected?: EcosystemIntegration | null;
  recentSyncJobs: IntegrationDashboard["recentSyncJobs"];
  onSyncAll: () => void;
  syncPending?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Installed</div>
          <div className="mt-1 text-3xl font-semibold">{dashboard.total}</div>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Connected</div>
          <div className="mt-1 text-3xl font-semibold">{dashboard.connected}</div>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">Errors</div>
          <div className="mt-1 text-3xl font-semibold">{dashboard.errored}</div>
        </div>
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
            Sync success
          </div>
          <div className="mt-1 text-3xl font-semibold">
            {Math.round(dashboard.recentSuccessRate * 100)}%
          </div>
        </div>
      </div>

      {selected ? (
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
            Selected sync policy
          </div>
          <p className="mt-2 text-sm">
            <span className="font-medium">{selected.name}</span> · {selected.syncMode} every{" "}
            {selected.syncIntervalMinutes} minutes
          </p>
          <p className="mt-1 font-mono text-xs text-[var(--tc-muted)]">
            scopes: {selected.scopes.join(", ") || "—"}
          </p>
        </div>
      ) : (
        <FormHint>Select an integration to inspect its sync policy.</FormHint>
      )}

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Recent sync jobs</h3>
        <Button type="button" disabled={syncPending} onClick={onSyncAll}>
          {syncPending ? "Syncing…" : "Sync all"}
        </Button>
      </div>
      {recentSyncJobs.length === 0 ? (
        <FormHint>No sync jobs yet.</FormHint>
      ) : (
        <ul className="space-y-2">
          {recentSyncJobs.slice(0, 6).map((j) => (
            <li
              key={j.id}
              className="flex items-center justify-between rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
            >
              <span className="font-mono text-xs">{j.id.slice(0, 8)}…</span>
              <Badge tone={j.status === "completed" ? "success" : "neutral"}>{j.status}</Badge>
              <span className="text-xs text-[var(--tc-muted)]">{j.mode}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
