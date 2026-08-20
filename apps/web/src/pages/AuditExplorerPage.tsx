import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  AuditEventCard,
  AuditExportDialog,
  AuditFilters,
  AuditSearchBar,
  emptyAuditFilters,
  useAuditEvents,
  useAuditExport,
  useAuditStatus,
  type AuditFiltersState,
} from "../features/audit";

export function AuditExplorerPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const [draftQ, setDraftQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [draftFilters, setDraftFilters] = useState<AuditFiltersState>(emptyAuditFilters);
  const [appliedFilters, setAppliedFilters] = useState<AuditFiltersState>(emptyAuditFilters);
  const [exportOpen, setExportOpen] = useState(false);

  const filters = useMemo(
    () => ({
      q: appliedQ || undefined,
      action: appliedFilters.action || undefined,
      actorUserId: appliedFilters.actorUserId || undefined,
      resourceType: appliedFilters.resourceType || undefined,
      resourceId: appliedFilters.resourceId || undefined,
      correlationId: appliedFilters.correlationId || undefined,
      requestId: appliedFilters.requestId || undefined,
      source: appliedFilters.source || undefined,
      success: appliedFilters.success || undefined,
      actorIp: appliedFilters.actorIp || undefined,
      from: appliedFilters.from || undefined,
      to: appliedFilters.to || undefined,
    }),
    [appliedQ, appliedFilters],
  );

  const events = useAuditEvents(organizationId, filters, canManage);
  const status = useAuditStatus(organizationId, canManage);
  const exportMutation = useAuditExport();

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Audit explorer" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Audit explorer" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Audit explorer"
        description="Immutable platform audit events with actor, resource, IP, and request tracking."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/audit/timeline" className="text-[var(--tc-accent)] hover:underline">
              Timeline
            </Link>
            <Button type="button" size="sm" onClick={() => setExportOpen(true)}>
              Export
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Total events" value={String(status.data?.totalEvents ?? "—")} />
        <Stat label="Failures" value={String(status.data?.failureCount ?? "—")} />
        <Stat
          label="Last event"
          value={
            status.data?.lastEventAt
              ? new Date(status.data.lastEventAt).toLocaleString()
              : "—"
          }
        />
      </div>

      <div className="mb-6 space-y-4">
        <AuditSearchBar
          value={draftQ}
          onChange={setDraftQ}
          onSubmit={() => {
            setAppliedQ(draftQ);
            setAppliedFilters(draftFilters);
          }}
        />
        <AuditFilters
          value={draftFilters}
          onChange={setDraftFilters}
          onApply={() => {
            setAppliedQ(draftQ);
            setAppliedFilters(draftFilters);
          }}
        />
      </div>

      {events.isError ? <FormError>{getApiErrorMessage(events.error)}</FormError> : null}
      {events.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading audit events…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[var(--tc-muted)]">
            {events.data?.total ?? 0} event{(events.data?.total ?? 0) === 1 ? "" : "s"}
          </p>
          <div className="grid gap-3 lg:grid-cols-2">
            {(events.data?.events ?? []).map((event) => (
              <AuditEventCard
                key={event.id}
                event={event}
                onSelectCorrelation={(correlationId) => {
                  setDraftFilters((f) => ({ ...f, correlationId }));
                  setAppliedFilters((f) => ({ ...f, correlationId }));
                }}
              />
            ))}
          </div>
          {(events.data?.events ?? []).length === 0 ? (
            <FormHint>No audit events match these filters.</FormHint>
          ) : null}
        </div>
      )}

      <AuditExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        pending={exportMutation.isPending}
        error={exportMutation.isError ? getApiErrorMessage(exportMutation.error) : null}
        lastContent={exportMutation.data?.export.content ?? null}
        onExport={(format) => {
          exportMutation.mutate({
            organizationId,
            format,
            ...Object.fromEntries(
              Object.entries(filters).filter(([, v]) => v !== undefined),
            ),
            success:
              filters.success === "true"
                ? true
                : filters.success === "false"
                  ? false
                  : undefined,
          });
        }}
      />
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
