import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { NotificationAnalytics } from "../../services/notificationOpsTypes";

function Stat({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface-2)] px-3 py-2">
      <p className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[var(--tc-fg)]">{value ?? "—"}</p>
    </div>
  );
}

export function DeliveryDashboard({
  delivery,
  channels,
  digests,
}: {
  delivery?: NotificationAnalytics["delivery"];
  channels?: NotificationAnalytics["channels"];
  digests?: NotificationAnalytics["digests"];
}) {
  if (!delivery || !channels || !digests) {
    return <FormHint>Loading delivery dashboard…</FormHint>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
          <CardDescription>Outbox completion and latency</CardDescription>
        </CardHeader>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-3">
          <Stat label="Delivered" value={delivery.delivered} />
          <Stat label="Sent" value={delivery.sent} />
          <Stat label="Failed" value={delivery.failed} />
          <Stat label="Dead letters" value={delivery.deadLetter} />
          <Stat
            label="Success rate"
            value={delivery.successRate == null ? "—" : `${delivery.successRate}%`}
          />
          <Stat
            label="Avg delivery time"
            value={
              delivery.averageDeliveryTimeMs == null
                ? "—"
                : `${delivery.averageDeliveryTimeMs} ms (n=${delivery.sampleSize})`
            }
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Channel utilization</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2 px-6 pb-6">
          <Badge tone="info">In-app {channels.inAppNotifications}</Badge>
          <Badge tone="neutral">Email outbox {channels.emailOutbox}</Badge>
          <Badge tone="warning">Email pending-like {channels.emailPendingLike}</Badge>
          <Badge tone="success">Email delivered {channels.emailDelivered}</Badge>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Digest volume (sample)</CardTitle>
        </CardHeader>
        <div className="grid gap-3 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Immediate" value={digests.immediate} />
          <Stat label="Daily" value={digests.daily} />
          <Stat label="Weekly" value={digests.weekly} />
          <Stat label="Pending digests" value={digests.pendingDigest} />
        </div>
      </Card>
    </div>
  );
}
