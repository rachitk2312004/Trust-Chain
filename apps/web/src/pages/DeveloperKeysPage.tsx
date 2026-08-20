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
  ApiKeyDialog,
  ApiKeyTable,
  useDeleteDeveloperApiKey,
  useDeveloperApiKeys,
  usePatchDeveloperApiKey,
} from "../features/developer";

export function DeveloperKeysPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const keys = useDeveloperApiKeys(organizationId, undefined, canManage);
  const patch = usePatchDeveloperApiKey();
  const remove = useDeleteDeveloperApiKey();
  const feedback = useFeedback();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="API keys" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="API keys" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="API keys"
        description="Create, rotate, revoke, and scope organization API keys."
        actions={
          <div className="flex flex-wrap gap-3">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              Create key
            </Button>
            <Link to="/developer" className="text-sm text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      {revealedSecret ? (
        <FormHint>
          New secret (copy now): <span className="font-mono text-xs">{revealedSecret}</span>
        </FormHint>
      ) : null}

      {keys.isError ? <FormError>{getApiErrorMessage(keys.error)}</FormError> : null}
      {keys.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading keys…</p>
      ) : (
        <ApiKeyTable
          keys={keys.data?.keys ?? []}
          busyId={busyId}
          onRotate={(key) => {
            setBusyId(key.id);
            patch.mutate(
              { keyId: key.id, organizationId, body: { rotate: true } },
              {
                onSuccess: (data) => {
                  if (data.secret) setRevealedSecret(data.secret);
                  feedback.success("Key rotated");
                },
                onError: (err) => feedback.error(err, "Rotate failed"),
                onSettled: () => setBusyId(null),
              },
            );
          }}
          onRevoke={(key) => {
            setBusyId(key.id);
            remove.mutate(
              { keyId: key.id, organizationId },
              {
                onSuccess: () => feedback.success("Key revoked"),
                onError: (err) => feedback.error(err, "Revoke failed"),
                onSettled: () => setBusyId(null),
              },
            );
          }}
        />
      )}

      <ApiKeyDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
      />
    </AppShellLayout>
  );
}
