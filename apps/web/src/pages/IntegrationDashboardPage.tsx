import { useState } from "react";
import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  IntegrationTable,
  OAuthDialog,
  SyncPolicyPanel,
  useIntegrationOAuth,
  useIntegrations,
  usePatchIntegration,
  useSyncIntegrations,
} from "../features/integrations";
import type { EcosystemIntegration } from "../services/integrationApi";

export function IntegrationDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const integrations = useIntegrations(organizationId, canManage);
  const patch = usePatchIntegration();
  const oauth = useIntegrationOAuth();
  const sync = useSyncIntegrations();

  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<EcosystemIntegration | null>(null);
  const [oauthTarget, setOauthTarget] = useState<EcosystemIntegration | null>(null);
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null);
  const [oauthState, setOauthState] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Integrations" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Integrations" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Integrations"
        description="OAuth and API connectors, sync policies, credentials, and event subscriptions."
        actions={
          <Link
            to="/integrations/marketplace"
            className="text-sm text-[var(--tc-accent)] hover:underline"
          >
            Marketplace
          </Link>
        }
      />

      {integrations.isError ? (
        <FormError>{getApiErrorMessage(integrations.error)}</FormError>
      ) : null}
      {oauth.isError ? <FormError>{getApiErrorMessage(oauth.error)}</FormError> : null}
      {sync.isError ? <FormError>{getApiErrorMessage(sync.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      {integrations.isLoading || !integrations.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading integrations…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <SyncPolicyPanel
              dashboard={integrations.data.dashboard}
              selected={selected}
              recentSyncJobs={integrations.data.recentSyncJobs}
              syncPending={sync.isPending}
              onSyncAll={() => {
                sync.mutate(
                  { organizationId, force: true },
                  {
                    onSuccess: (data) => {
                      setMessage(
                        `Sync finished · ${data.jobs.length} jobs · ${data.skipped} skipped`,
                      );
                    },
                  },
                );
              }}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Installed
            </h2>
            <div
              onClick={(e) => {
                const row = (e.target as HTMLElement).closest("tr");
                if (!row) return;
              }}
            >
              <IntegrationTable
                integrations={integrations.data.integrations}
                onOAuth={(i) => {
                  setOauthTarget(i);
                  setAuthorizeUrl(null);
                  setOauthState(null);
                  setSelected(i);
                }}
                onSync={(i) => {
                  setSelected(i);
                  sync.mutate(
                    { organizationId, integrationId: i.id, force: true },
                    {
                      onSuccess: (data) => {
                        setMessage(
                          `Synced ${i.name} · ${data.jobs[0]?.result.recordsProcessed ?? 0} records`,
                        );
                      },
                    },
                  );
                }}
                onRotate={(i) => {
                  setSelected(i);
                  patch.mutate(
                    { id: i.id, body: { rotateCredential: true } },
                    {
                      onSuccess: (data) => {
                        setMessage(
                          data.rotation?.issuedSecret
                            ? `Rotated key ****${data.rotation.secretLast4} (copy now: ${data.rotation.issuedSecret.slice(0, 16)}…)`
                            : `Credential rotated to v${data.rotation?.version}`,
                        );
                      },
                    },
                  );
                }}
                onDisable={(i) => {
                  setSelected(i);
                  patch.mutate(
                    { id: i.id, body: { status: "disabled" } },
                    { onSuccess: () => setMessage(`${i.name} disabled`) },
                  );
                }}
              />
            </div>
          </section>
        </div>
      )}

      <OAuthDialog
        open={Boolean(oauthTarget)}
        onClose={() => setOauthTarget(null)}
        integration={oauthTarget}
        pending={oauth.isPending}
        authorizeUrl={authorizeUrl}
        initialState={oauthState}
        onStart={({ clientId, redirectUri }) => {
          if (!oauthTarget) return;
          oauth.mutate(
            {
              organizationId,
              integrationId: oauthTarget.id,
              action: "start",
              clientId,
              redirectUri,
            },
            {
              onSuccess: (data) => {
                if (data.authorizeUrl) setAuthorizeUrl(data.authorizeUrl);
                if (data.state) setOauthState(data.state);
                setMessage("OAuth started — complete with state + code");
              },
            },
          );
        }}
        onComplete={({ state, code }) => {
          if (!oauthTarget) return;
          oauth.mutate(
            {
              organizationId,
              integrationId: oauthTarget.id,
              action: "complete",
              state: state || oauthState || "",
              code,
            },
            {
              onSuccess: () => {
                setMessage(`${oauthTarget.name} connected via OAuth`);
                setOauthTarget(null);
              },
            },
          );
        }}
      />
    </AppShellLayout>
  );
}
