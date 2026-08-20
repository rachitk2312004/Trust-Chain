import { useState } from "react";
import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  ConnectorDetailCard,
  InstallationDialog,
  MarketplaceAnalyticsCard,
  MarketplaceTable,
  useInstallMarketplaceConnector,
  useMarketplace,
  useMarketplaceAnalytics,
  useMarketplaceReviews,
} from "../features/marketplace";
import type { MarketplaceListing } from "../services/marketplaceApi";

export function MarketplaceDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const marketplace = useMarketplace(organizationId, canManage);
  const analytics = useMarketplaceAnalytics(organizationId, canManage);
  const reviews = useMarketplaceReviews(organizationId, canManage);
  const install = useInstallMarketplaceConnector();

  const [selected, setSelected] = useState<MarketplaceListing | null>(null);
  const [installTarget, setInstallTarget] = useState<MarketplaceListing | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Marketplace" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Marketplace" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const installedIds = new Set(
    marketplace.data?.installations.map((i) => i.listingId) ?? [],
  );

  return (
    <AppShellLayout>
      <PageHeader
        title="Connector marketplace"
        description="Browse published connectors, check compatibility, install, and review."
        actions={
          <Link
            to="/marketplace/publisher"
            className="text-sm text-[var(--tc-accent)] hover:underline"
          >
            Publisher console
          </Link>
        }
      />

      {marketplace.isError ? (
        <FormError>{getApiErrorMessage(marketplace.error)}</FormError>
      ) : null}
      {install.isError ? <FormError>{getApiErrorMessage(install.error)}</FormError> : null}
      {message ? <FormHint>{message}</FormHint> : null}

      {analytics.data ? (
        <section className="mb-10">
          <MarketplaceAnalyticsCard
            analytics={analytics.data.analytics}
            platformVersion={analytics.data.platformVersion}
          />
        </section>
      ) : null}

      {marketplace.isLoading || !marketplace.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading marketplace…</p>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Listings
            </h2>
            <MarketplaceTable
              listings={marketplace.data.listings}
              installedListingIds={installedIds}
              onSelect={setSelected}
              onInstall={setInstallTarget}
            />
          </section>

          {selected ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Details
              </h2>
              <ConnectorDetailCard listing={selected} />
            </section>
          ) : null}

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Recent reviews
            </h2>
            {reviews.isLoading || !reviews.data ? (
              <p className="text-sm text-[var(--tc-muted)]">Loading reviews…</p>
            ) : reviews.data.reviews.length === 0 ? (
              <FormHint>No reviews yet.</FormHint>
            ) : (
              <ul className="space-y-2">
                {reviews.data.reviews.slice(0, 8).map((r) => (
                  <li
                    key={r.id}
                    className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
                  >
                    <div className="font-medium">
                      {r.title} · {r.rating}★
                    </div>
                    <div className="text-xs text-[var(--tc-muted)]">{r.listingName}</div>
                    {r.body ? <p className="mt-1 text-xs">{r.body}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <InstallationDialog
        open={Boolean(installTarget)}
        onClose={() => setInstallTarget(null)}
        listing={installTarget}
        pending={install.isPending}
        onInstall={(input) => {
          if (!installTarget) return;
          install.mutate(
            {
              organizationId,
              listingId: installTarget.id,
              version: input.version,
              review: input.review,
            },
            {
              onSuccess: (data) => {
                setMessage(
                  `Installed ${installTarget.name} @ ${data.installation.installedVersion}`,
                );
                setInstallTarget(null);
              },
            },
          );
        }}
      />
    </AppShellLayout>
  );
}
