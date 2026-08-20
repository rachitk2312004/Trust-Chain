import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../../components/PageHeader";
import { useFeedback } from "../../hooks/useFeedback";
import { usePermissions } from "../../hooks/usePermissions";
import { AppShellLayout } from "../../layouts/AppShellLayout";
import { getNotificationErrorMessage } from "../../lib/notificationErrors";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { DeliveryDashboard } from "./DeliveryDashboard";
import { FailureDashboard } from "./FailureDashboard";
import { QueueDashboard } from "./QueueDashboard";
import { RetentionControls } from "./RetentionControls";
import {
  useInspectOutbox,
  useNotificationAnalytics,
  useNotificationDeliveryStats,
  useNotificationFailures,
  useNotificationObservability,
  useNotificationQueueStats,
  useNotificationRetentionPreview,
  usePurgeNotificationRetention,
  useRetryDeadLetters,
} from "./opsHooks";

type Tab = "analytics" | "failures" | "delivery" | "queue" | "retention";

export function NotificationOpsPage() {
  const { isOpsAdmin } = usePermissions();
  const feedback = useFeedback();
  const [tab, setTab] = useState<Tab>("analytics");
  const [inspectJson, setInspectJson] = useState<string | null>(null);

  const analytics = useNotificationAnalytics();
  const observability = useNotificationObservability();
  const queue = useNotificationQueueStats();
  const delivery = useNotificationDeliveryStats();
  const failures = useNotificationFailures();
  const retention = useNotificationRetentionPreview();
  const retry = useRetryDeadLetters();
  const purge = usePurgeNotificationRetention();
  const inspect = useInspectOutbox();

  if (!isOpsAdmin) {
    return (
      <AppShellLayout>
        <PageHeader title="Notification ops" description="Ops admin role required." />
        <FormError>You do not have permission to view notification operations.</FormError>
        <Link to="/notifications" className="mt-4 inline-block text-sm text-[var(--tc-accent)]">
          Back to inbox
        </Link>
      </AppShellLayout>
    );
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "analytics", label: "Analytics" },
    { id: "failures", label: "Failures" },
    { id: "delivery", label: "Delivery" },
    { id: "queue", label: "Queue" },
    { id: "retention", label: "Retention" },
  ];

  return (
    <AppShellLayout>
      <PageHeader
        title="Notification ops"
        description="Delivery analytics, queue health, dead-letter recovery, and retention."
        actions={
          <Link to="/notifications" className="text-sm text-[var(--tc-accent)] hover:underline">
            Inbox
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "primary" : "ghost"}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {analytics.isError || observability.isError ? (
        <FormError>
          {getNotificationErrorMessage(analytics.error ?? observability.error)}
        </FormError>
      ) : null}

      {tab === "analytics" ? (
        <AnalyticsDashboard
          analytics={analytics.data}
          observability={observability.data}
        />
      ) : null}

      {tab === "failures" ? (
        <FailureDashboard
          failures={failures.data?.failures}
          deadLetters={failures.data?.deadLetters}
          retrying={retry.isPending}
          onRetryAll={() =>
            retry.mutate(
              { limit: 50 },
              {
                onSuccess: (r) => feedback.success(`Recovered ${r.recovered} dead letters`),
                onError: (e) => feedback.error(e, "Retry failed"),
              },
            )
          }
          onRetryOne={(id) =>
            retry.mutate(
              { ids: [id] },
              {
                onSuccess: () => feedback.success("Dead letter requeued"),
                onError: (e) => feedback.error(e, "Retry failed"),
              },
            )
          }
          onInspect={(id) =>
            inspect.mutate(id, {
              onSuccess: (data) => setInspectJson(JSON.stringify(data.outbox, null, 2)),
              onError: (e) => feedback.error(e, "Inspect failed"),
            })
          }
        />
      ) : null}

      {tab === "delivery" ? (
        <DeliveryDashboard
          delivery={delivery.data?.delivery}
          channels={delivery.data?.channels}
          digests={delivery.data?.digests}
        />
      ) : null}

      {tab === "queue" ? (
        <QueueDashboard queue={queue.data?.queue} retries={queue.data?.retries} />
      ) : null}

      {tab === "retention" ? (
        <RetentionControls
          preview={retention.data}
          purging={purge.isPending}
          onPurge={(policy) =>
            purge.mutate(policy, {
              onSuccess: (r) =>
                feedback.success(
                  `Purged ${r.deletedNotifications} notifications, ${r.deletedOutbox} outbox rows`,
                ),
              onError: (e) => feedback.error(e, "Purge failed"),
            })
          }
        />
      ) : null}

      {inspectJson ? (
        <div className="mt-4 rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">Outbox inspection</p>
            <Button size="sm" variant="ghost" onClick={() => setInspectJson(null)}>
              Close
            </Button>
          </div>
          <pre className="max-h-80 overflow-auto text-xs text-[var(--tc-muted)]">{inspectJson}</pre>
        </div>
      ) : null}

      {analytics.isLoading && tab === "analytics" ? <FormHint>Loading…</FormHint> : null}
    </AppShellLayout>
  );
}
