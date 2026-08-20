import { Link } from "react-router-dom";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { useReindexSearch, useSearchStatus } from "../features/search";

export function SearchAdministrationPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canAdmin = isOrgAdmin || isSuperAdmin;
  const status = useSearchStatus(organizationId, canAdmin);
  const reindex = useReindexSearch();

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Search administration" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canAdmin) {
    return (
      <AppShellLayout>
        <PageHeader title="Search administration" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Search administration"
        description="Inspect index health and trigger a reindex for this organization."
        actions={
          <Link to="/search" className="text-sm text-[var(--tc-accent)] hover:underline">
            Search
          </Link>
        }
      />

      {status.isError ? <FormError>{getApiErrorMessage(status.error)}</FormError> : null}
      {reindex.isError ? <FormError>{getApiErrorMessage(reindex.error)}</FormError> : null}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          disabled={reindex.isPending}
          onClick={() => reindex.mutate({ organizationId })}
        >
          {reindex.isPending ? "Reindexing…" : "Reindex organization"}
        </Button>
        {reindex.data?.job ? (
          <span className="text-sm text-[var(--tc-muted)]">
            Last job {reindex.data.job.status} · {reindex.data.job.indexedCount} entries
          </span>
        ) : null}
      </div>

      {status.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading index status…</p>
      ) : (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-3">
            <Stat label="Total entries" value={String(status.data?.totalEntries ?? 0)} />
            <Stat
              label="Last indexed"
              value={
                status.data?.lastIndexedAt
                  ? new Date(status.data.lastIndexedAt).toLocaleString()
                  : "Never"
              }
            />
            <Stat
              label="Latest job"
              value={status.data?.latestJob?.status ?? "—"}
            />
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              By entity type
            </h2>
            <ul className="space-y-2 text-sm">
              {Object.entries(status.data?.byEntityType ?? {}).map(([type, count]) => (
                <li key={type} className="flex justify-between border-b border-[var(--tc-border)] py-2">
                  <span className="font-mono text-xs">{type}</span>
                  <span>{count}</span>
                </li>
              ))}
              {Object.keys(status.data?.byEntityType ?? {}).length === 0 ? (
                <FormHint>Index is empty. Run a reindex.</FormHint>
              ) : null}
            </ul>
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  );
}
