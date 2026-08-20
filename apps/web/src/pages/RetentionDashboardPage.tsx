import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  RetentionPolicyTable,
  RetentionRunDialog,
  RetentionStatusCard,
  useCreateRetentionPolicy,
  useRetentionPolicies,
  useRetentionStatus,
  useRunRetention,
} from "../features/retention";

export function RetentionDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const policies = useRetentionPolicies(organizationId, canManage);
  const status = useRetentionStatus(organizationId, canManage);
  const create = useCreateRetentionPolicy();
  const run = useRunRetention();
  const [runOpen, setRunOpen] = useState(false);
  const [name, setName] = useState("Document retention");
  const [targetType, setTargetType] = useState("document");
  const [retentionDays, setRetentionDays] = useState("365");
  const [disposition, setDisposition] = useState("archive");
  const [lastSummary, setLastSummary] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Retention" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Retention" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Retention"
        description="Policies, automated archive/purge, and custody-preserving retention runs."
        actions={
          <div className="flex items-center gap-3">
            <Link to="/retention/holds" className="text-sm text-[var(--tc-accent)] hover:underline">
              Legal holds
            </Link>
            <Button type="button" onClick={() => setRunOpen(true)}>
              Run
            </Button>
          </div>
        }
      />

      {policies.isError ? <FormError>{getApiErrorMessage(policies.error)}</FormError> : null}
      {status.isError ? <FormError>{getApiErrorMessage(status.error)}</FormError> : null}
      {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}
      {run.isError ? <FormError>{getApiErrorMessage(run.error)}</FormError> : null}
      {lastSummary ? <FormHint>{lastSummary}</FormHint> : null}

      <section className="mb-8">
        {status.isLoading || !status.data ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading status…</p>
        ) : (
          <RetentionStatusCard status={status.data} />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Add policy
        </h2>
        <form
          className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              organizationId,
              name,
              targetType,
              retentionDays: Number(retentionDays),
              disposition,
            });
          }}
        >
          <div className="lg:col-span-2">
            <Label htmlFor="pol-name">Name</Label>
            <Input id="pol-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="pol-target">Target</Label>
            <select
              id="pol-target"
              className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
            >
              <option value="document">document</option>
              <option value="certificate">certificate</option>
              <option value="signature">signature</option>
              <option value="audit_event">audit_event</option>
              <option value="evidence">evidence</option>
              <option value="report">report</option>
            </select>
          </div>
          <div>
            <Label htmlFor="pol-days">Days</Label>
            <Input
              id="pol-days"
              type="number"
              min={1}
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="pol-disp">Disposition</Label>
            <select
              id="pol-disp"
              className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
            >
              <option value="archive">archive</option>
              <option value="purge">purge</option>
            </select>
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-5">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Saving…" : "Create policy"}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Policies
        </h2>
        {policies.isLoading ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading policies…</p>
        ) : (
          <RetentionPolicyTable policies={policies.data?.policies ?? []} />
        )}
      </section>

      <RetentionRunDialog
        open={runOpen}
        onClose={() => setRunOpen(false)}
        pending={run.isPending}
        onRun={(input) => {
          run.mutate(
            { organizationId, ...input },
            {
              onSuccess: (data) => {
                const s = data.run.summary;
                setLastSummary(
                  `Run ${data.run.status}: archived ${s.archived}, purged ${s.purged}, hold-blocked ${s.holdBlocked}, skipped ${s.skipped}, chain ${s.chainValid ? "ok" : "broken"}`,
                );
                setRunOpen(false);
              },
            },
          );
        }}
      />
    </AppShellLayout>
  );
}
