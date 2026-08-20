import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { Button, FormError, FormHint, Badge } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  DeliveryTimeline,
  WebhookDeliveryTable,
  WebhookReplayDialog,
  WebhookTestDialog,
  useWebhookDeliveries,
  useWebhookDetail,
  useWebhookDelivery,
} from "../features/developer";
import type { DeveloperWebhookDelivery } from "../types/api";

export function DeveloperWebhookDetailPage() {
  const { webhookId } = useParams<{ webhookId: string }>();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const detail = useWebhookDetail(webhookId, canManage);
  const deliveries = useWebhookDeliveries(webhookId, undefined, canManage);

  const [testOpen, setTestOpen] = useState(false);
  const [replayTarget, setReplayTarget] = useState<DeveloperWebhookDelivery | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useWebhookDelivery(webhookId, selectedId, Boolean(selectedId));

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Webhook" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Webhook" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  if (!webhookId) {
    return (
      <AppShellLayout>
        <PageHeader title="Webhook" />
        <FormError>Missing webhook id</FormError>
      </AppShellLayout>
    );
  }

  const webhook = detail.data?.webhook;

  return (
    <AppShellLayout>
      <PageHeader
        title={webhook?.name ?? "Webhook"}
        description={webhook?.url}
        actions={
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => setTestOpen(true)}>
              Send test
            </Button>
            <Link
              to="/developer/webhooks"
              className="text-sm text-[var(--tc-accent)] hover:underline"
            >
              All webhooks
            </Link>
          </div>
        }
      />

      {detail.isError ? <FormError>{getApiErrorMessage(detail.error)}</FormError> : null}
      {detail.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading…</p>
      ) : webhook ? (
        <div className="mb-6 space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Badge tone={webhook.status === "active" ? "success" : "neutral"}>
              {webhook.status}
            </Badge>
            <span className="font-mono text-xs text-[var(--tc-muted)]">{webhook.publicCode}</span>
          </div>
          <div>
            Events: <span className="text-[var(--tc-muted)]">{webhook.events.join(", ")}</span>
          </div>
          <div>
            Retry: max {webhook.retryPolicy.maxAttempts}, initial{" "}
            {webhook.retryPolicy.initialDelayMs}ms × {webhook.retryPolicy.backoffMultiplier}
          </div>
          <div>Failures: {webhook.failureCount}</div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Delivery history
          </h2>
          {deliveries.isError ? (
            <FormError>{getApiErrorMessage(deliveries.error)}</FormError>
          ) : null}
          {deliveries.isLoading ? (
            <p className="text-sm text-[var(--tc-muted)]">Loading deliveries…</p>
          ) : (
            <WebhookDeliveryTable
              deliveries={deliveries.data?.deliveries ?? []}
              onReplay={setReplayTarget}
              onSelect={(d) => setSelectedId(d.id)}
            />
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Delivery detail
          </h2>
          {selectedId && selected.data?.delivery ? (
            <DeliveryTimeline delivery={selected.data.delivery} />
          ) : (
            <FormHint>Select a delivery to inspect payload and timeline.</FormHint>
          )}
        </section>
      </div>

      <WebhookTestDialog
        open={testOpen}
        onClose={() => setTestOpen(false)}
        webhookId={webhookId}
        organizationId={organizationId}
      />
      <WebhookReplayDialog
        open={Boolean(replayTarget)}
        onClose={() => setReplayTarget(null)}
        webhookId={webhookId}
        organizationId={organizationId}
        delivery={replayTarget}
      />
    </AppShellLayout>
  );
}
