import { useState } from "react";
import { Link } from "react-router-dom";
import { FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  ConnectorCard,
  useCreateIntegration,
  useIntegrations,
} from "../features/integrations";

export function ConnectorMarketplacePage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const integrations = useIntegrations(organizationId, canManage);
  const create = useCreateIntegration();
  const [filter, setFilter] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Connector marketplace" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Connector marketplace" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const installedKeys = new Set(
    integrations.data?.integrations.map((i) => i.connectorKey) ?? [],
  );
  const catalog =
    integrations.data?.catalog.filter((c) => {
      if (!filter.trim()) return true;
      const q = filter.toLowerCase();
      return (
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.key.toLowerCase().includes(q)
      );
    }) ?? [];

  return (
    <AppShellLayout>
      <PageHeader
        title="Connector marketplace"
        description="Identity, communication, storage, and project management connectors."
        actions={
          <Link to="/integrations" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {integrations.isError ? (
        <FormError>{getApiErrorMessage(integrations.error)}</FormError>
      ) : null}
      {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      <div className="mb-6 max-w-sm">
        <Label htmlFor="mp-filter">Filter</Label>
        <Input
          id="mp-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search connectors…"
        />
      </div>

      {integrations.isLoading || !integrations.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading marketplace…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalog.map((c) => (
            <ConnectorCard
              key={c.key}
              connector={c}
              installed={installedKeys.has(c.key)}
              pending={create.isPending}
              onInstall={() => {
                create.mutate(
                  {
                    organizationId,
                    connectorKey: c.key,
                    name: `${c.name} (${new Date().toISOString().slice(0, 10)})`,
                    authMode: c.authMode,
                    scopes: c.defaultScopes,
                    eventTypes: c.eventTypes.slice(0, 2),
                  },
                  {
                    onSuccess: (data) => {
                      setMessage(
                        data.issuedApiKey
                          ? `Installed ${c.name} · API key ${data.issuedApiKey.slice(0, 18)}…`
                          : `Installed ${c.name} · complete OAuth to connect`,
                      );
                    },
                  },
                );
              }}
            />
          ))}
        </div>
      )}
    </AppShellLayout>
  );
}
