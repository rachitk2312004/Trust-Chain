import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  MarketplaceAnalyticsCard,
  MarketplaceTable,
  useMarketplace,
  useMarketplaceAnalytics,
  usePatchMarketplaceConnector,
  usePublishConnector,
} from "../features/marketplace";

export function MarketplacePublisherPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const marketplace = useMarketplace(organizationId, canManage, {
    publisherOrgId: organizationId ?? undefined,
  });
  const analytics = useMarketplaceAnalytics(organizationId, canManage);
  const publish = usePublishConnector();
  const patch = usePatchMarketplaceConnector();

  const [name, setName] = useState("Slack Notifier Pro");
  const [summary, setSummary] = useState("Enhanced Slack notifications for TrustChain events");
  const [category, setCategory] = useState("communication");
  const [connectorKey, setConnectorKey] = useState("slack");
  const [authMode, setAuthMode] = useState("oauth");
  const [version, setVersion] = useState("1.0.0");
  const [minPlatform, setMinPlatform] = useState("1.0.0");
  const [message, setMessage] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Publisher" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Publisher" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const mine =
    marketplace.data?.listings.filter((l) => l.publisherOrgId === organizationId) ??
    // when browsing published-only, refetch with status draft needs publisher view
    [];

  return (
    <AppShellLayout>
      <PageHeader
        title="Marketplace publisher"
        description="Publish connector listings, manage versions, and track analytics."
        actions={
          <Link to="/marketplace" className="text-sm text-[var(--tc-accent)] hover:underline">
            Marketplace
          </Link>
        }
      />

      {publish.isError ? <FormError>{getApiErrorMessage(publish.error)}</FormError> : null}
      {patch.isError ? <FormError>{getApiErrorMessage(patch.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      {analytics.data ? (
        <section className="mb-10">
          <MarketplaceAnalyticsCard
            analytics={analytics.data.analytics}
            platformVersion={analytics.data.platformVersion}
          />
        </section>
      ) : null}

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Publish connector
        </h2>
        <form
          className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            publish.mutate(
              {
                publisherOrgId: organizationId,
                name,
                summary,
                category,
                connectorKey: connectorKey || null,
                authMode,
                version,
                minPlatformVersion: minPlatform,
                publish: true,
                changelog: "Initial marketplace release",
              },
              {
                onSuccess: (data) => {
                  setMessage(`Published ${data.listing.slug} @ ${data.version.version}`);
                },
              },
            );
          }}
        >
          <div>
            <Label htmlFor="pub-name">Name</Label>
            <Input id="pub-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="pub-summary">Summary</Label>
            <Input
              id="pub-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="pub-cat">Category</Label>
            <Input
              id="pub-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="pub-key">Connector key</Label>
            <Input
              id="pub-key"
              value={connectorKey}
              onChange={(e) => setConnectorKey(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pub-auth">Auth mode</Label>
            <Input
              id="pub-auth"
              value={authMode}
              onChange={(e) => setAuthMode(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="pub-ver">Version</Label>
            <Input
              id="pub-ver"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="pub-min">Min platform</Label>
            <Input
              id="pub-min"
              value={minPlatform}
              onChange={(e) => setMinPlatform(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={publish.isPending}>
              {publish.isPending ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Your listings
        </h2>
        {marketplace.isLoading ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading…</p>
        ) : (
          <MarketplaceTable
            listings={
              // Show all returned listings; publisher can publish and see them in catalog
              mine.length > 0 ? mine : (marketplace.data?.listings ?? [])
            }
            onSelect={(l) => {
              const next = prompt("New version (semver)", "1.1.0");
              if (!next) return;
              patch.mutate(
                {
                  id: l.id,
                  body: {
                    version: next,
                    changelog: `Release ${next}`,
                    publishVersion: true,
                    status: "published",
                  },
                },
                {
                  onSuccess: (data) => {
                    setMessage(
                      data.version
                        ? `Released ${l.name} @ ${data.version.version}`
                        : `Updated ${l.name}`,
                    );
                  },
                },
              );
            }}
          />
        )}
        <p className="mt-2 text-xs text-[var(--tc-muted)]">
          Click a listing name to release a new version.
        </p>
      </section>
    </AppShellLayout>
  );
}
