import { Link } from "react-router-dom";
import { useState } from "react";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  WebhookDialog,
  WebhookTable,
  useDeveloperWebhooks,
  usePatchDeveloperWebhook,
} from "../features/developer";

export function DeveloperWebhooksPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const webhooks = useDeveloperWebhooks(organizationId, undefined, canManage);
  const patch = usePatchDeveloperWebhook();
  const feedback = useFeedback();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Webhooks" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Webhooks" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Webhooks"
        description="Register endpoints, manage signing secrets, retry policy, and status."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Register webhook
            </Button>
            <Link to="/developer" className="text-sm text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      {secret ? (
        <FormHint>
          Signing secret (copy now): <span className="font-mono text-xs">{secret}</span>
        </FormHint>
      ) : null}

      {webhooks.isError ? <FormError>{getApiErrorMessage(webhooks.error)}</FormError> : null}
      {webhooks.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading webhooks…</p>
      ) : (
        <WebhookTable
          webhooks={webhooks.data?.webhooks ?? []}
          busyId={busyId}
          onRotateSecret={(webhook) => {
            setBusyId(webhook.id);
            patch.mutate(
              { id: webhook.id, organizationId, body: { rotateSecret: true } },
              {
                onSuccess: (data) => {
                  if (data.secret) setSecret(data.secret);
                  feedback.success("Secret rotated");
                },
                onError: (err) => feedback.error(err, "Rotate failed"),
                onSettled: () => setBusyId(null),
              },
            );
          }}
          onDisable={(webhook) => {
            setBusyId(webhook.id);
            patch.mutate(
              { id: webhook.id, organizationId, body: { status: "disabled" } },
              {
                onSuccess: () => feedback.success("Webhook disabled"),
                onError: (err) => feedback.error(err, "Disable failed"),
                onSettled: () => setBusyId(null),
              },
            );
          }}
        />
      )}

      <WebhookDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
      />
    </AppShellLayout>
  );
}
