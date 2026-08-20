import { Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { NotificationAnalytics, NotificationQueueStats } from "../../services/notificationOpsTypes";

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-[var(--tc-muted)]">{label}</span>
        <span className="font-medium text-[var(--tc-fg)]">{value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-[var(--tc-surface-2)]">
        <div className="h-full bg-[var(--tc-accent)]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function QueueDashboard({
  queue,
  retries,
}: {
  queue?: NotificationQueueStats;
  retries?: NotificationAnalytics["retries"];
}) {
  if (!queue || !retries) {
    return <FormHint>Loading queue dashboard…</FormHint>;
  }

  const max = Math.max(
    queue.pending,
    queue.processing,
    queue.retry,
    queue.failed,
    queue.delivered,
    queue.deadLetter,
    1,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Queue depth</CardTitle>
          <CardDescription>Active depth {queue.depth}</CardDescription>
        </CardHeader>
        <div className="space-y-3 px-6 pb-6">
          <Bar label="Pending" value={queue.pending} max={max} />
          <Bar label="Processing" value={queue.processing} max={max} />
          <Bar label="Retry" value={queue.retry} max={max} />
          <Bar label="Failed" value={queue.failed} max={max} />
          <Bar label="Delivered" value={queue.delivered} max={max} />
          <Bar label="Dead letter" value={queue.deadLetter} max={max} />
          <Bar label="Skipped" value={queue.skipped} max={max} />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Retry analysis</CardTitle>
          <CardDescription>
            {retries.retrying} currently retrying · max attempts{" "}
            {retries.maxAttemptsAmongRetries}
          </CardDescription>
        </CardHeader>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-3">
          <div className="rounded-md border border-[var(--tc-border)] px-3 py-2">
            <p className="text-xs text-[var(--tc-muted)]">Avg attempts</p>
            <p className="text-lg font-semibold">{retries.averageAttemptsAmongRetries ?? "—"}</p>
          </div>
          <div className="rounded-md border border-[var(--tc-border)] px-3 py-2">
            <p className="text-xs text-[var(--tc-muted)]">High attempt (≥3)</p>
            <p className="text-lg font-semibold">{retries.highAttemptCount}</p>
          </div>
          <div className="rounded-md border border-[var(--tc-border)] px-3 py-2">
            <p className="text-xs text-[var(--tc-muted)]">Retrying</p>
            <p className="text-lg font-semibold">{retries.retrying}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
