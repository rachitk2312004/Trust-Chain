import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { NotificationAnalytics, NotificationObservability } from "../../services/notificationOpsTypes";

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--tc-fg)]">{value ?? "—"}</p>
    </div>
  );
}

export function AnalyticsDashboard({
  analytics,
  observability,
}: {
  analytics?: NotificationAnalytics;
  observability?: NotificationObservability;
}) {
  if (!analytics) {
    return <FormHint>Loading analytics…</FormHint>;
  }

  const process = observability?.process;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Overview</CardTitle>
          <CardDescription>
            Generated {new Date(analytics.generatedAt).toLocaleString()}
            {observability ? ` · ${observability.connections.active} live SSE connections` : ""}
          </CardDescription>
        </CardHeader>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Inbox rows" value={analytics.notificationsCreated} />
          <Stat label="Soft-deleted" value={analytics.notificationsDeleted} />
          <Stat label="Outbox total" value={analytics.delivery.totalOutbox} />
          <Stat label="Queue depth" value={analytics.queue.depth} />
          <Stat label="Delivered" value={analytics.delivery.delivered} />
          <Stat label="Failed / DLQ" value={`${analytics.delivery.failed} / ${analytics.delivery.deadLetter}`} />
          <Stat
            label="Success rate"
            value={
              analytics.delivery.successRate == null ? "—" : `${analytics.delivery.successRate}%`
            }
          />
          <Stat
            label="Avg latency"
            value={
              analytics.delivery.averageDeliveryTimeMs == null
                ? "—"
                : `${analytics.delivery.averageDeliveryTimeMs} ms`
            }
          />
        </div>
      </Card>

      {process ? (
        <Card>
          <CardHeader>
            <CardTitle>Process metrics</CardTitle>
            <CardDescription>In-process counters for this API instance</CardDescription>
          </CardHeader>
          <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Created" value={process.notificationsCreated} />
            <Stat label="Delivered" value={process.notificationsDelivered} />
            <Stat label="Failed" value={process.notificationsFailed} />
            <Stat label="Retries" value={process.retryCount} />
            <Stat label="Dead letters" value={process.deadLetterCount} />
            <Stat label="Digest volume" value={process.digestVolume} />
            <Stat label="Queue depth" value={process.queueDepth} />
            <Stat label="Active connections" value={process.activeConnections} />
          </div>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Digests</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2 px-6 pb-6">
          <Badge tone="info">Immediate {analytics.digests.immediate}</Badge>
          <Badge tone="neutral">Daily {analytics.digests.daily}</Badge>
          <Badge tone="neutral">Weekly {analytics.digests.weekly}</Badge>
          <Badge tone="warning">Pending digest {analytics.digests.pendingDigest}</Badge>
        </div>
      </Card>
    </div>
  );
}
