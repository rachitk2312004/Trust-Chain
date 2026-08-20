import { useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint, Input, Label } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  BackupPolicyTable,
  RecoveryStatusCard,
  RestoreDialog,
  useCreateBackup,
  useCreateFailback,
  useCreateRestore,
  useRecoveryDashboard,
  useRecoveryStatus,
} from "../features/recovery";

export function RecoveryDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;

  const dashboard = useRecoveryDashboard(organizationId, canManage);
  const status = useRecoveryStatus(organizationId, canManage);
  const createBackup = useCreateBackup();
  const createRestore = useCreateRestore();
  const createFailback = useCreateFailback();

  const [restoreOpen, setRestoreOpen] = useState(false);
  const [name, setName] = useState("Primary daily backup");
  const [frequency, setFrequency] = useState("daily");
  const [regionCode, setRegionCode] = useState("eu-west-1");
  const [rpoMinutes, setRpoMinutes] = useState("60");
  const [rtoMinutes, setRtoMinutes] = useState("240");
  const [retentionDays, setRetentionDays] = useState("30");
  const [fromRegion, setFromRegion] = useState("us-east-1");
  const [toRegion, setToRegion] = useState("eu-west-1");
  const [failbackReason, setFailbackReason] = useState("Return traffic to primary after failover");
  const [message, setMessage] = useState<string | null>(null);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Recovery" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Recovery" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const latestBackup = dashboard.data?.recentBackups[0];

  return (
    <AppShellLayout>
      <PageHeader
        title="Disaster recovery"
        description="Backup policies, restore validation, failback, and continuity scoring."
        actions={
          <div className="flex items-center gap-3">
            <Link
              to="/recovery/reports"
              className="text-sm text-[var(--tc-accent)] hover:underline"
            >
              Continuity reports
            </Link>
            <Button type="button" variant="ghost" onClick={() => setRestoreOpen(true)}>
              Restore
            </Button>
          </div>
        }
      />

      {dashboard.isError ? <FormError>{getApiErrorMessage(dashboard.error)}</FormError> : null}
      {status.isError ? <FormError>{getApiErrorMessage(status.error)}</FormError> : null}
      {createBackup.isError ? (
        <FormError>{getApiErrorMessage(createBackup.error)}</FormError>
      ) : null}
      {createRestore.isError ? (
        <FormError>{getApiErrorMessage(createRestore.error)}</FormError>
      ) : null}
      {createFailback.isError ? (
        <FormError>{getApiErrorMessage(createFailback.error)}</FormError>
      ) : null}
      {message ? <FormHint>{message}</FormHint> : null}

      <section className="mb-8">
        {status.isLoading || !status.data ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading recovery status…</p>
        ) : (
          <RecoveryStatusCard status={status.data} />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Run backup
        </h2>
        <form
          className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            createBackup.mutate(
              {
                organizationId,
                policy: {
                  name,
                  frequency,
                  regionCode,
                  rpoMinutes: Number(rpoMinutes),
                  rtoMinutes: Number(rtoMinutes),
                  retentionDays: Number(retentionDays),
                  scopes: ["database", "documents"],
                  enabled: true,
                },
              },
              {
                onSuccess: (data) => {
                  setMessage(
                    `Backup ${data.backup.id.slice(0, 8)}… completed in ${data.backup.regionCode}`,
                  );
                },
              },
            );
          }}
        >
          <div>
            <Label htmlFor="bk-name">Policy name</Label>
            <Input id="bk-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="bk-freq">Frequency</Label>
            <Input
              id="bk-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="bk-region">Region</Label>
            <Input
              id="bk-region"
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="bk-rpo">RPO (minutes)</Label>
            <Input
              id="bk-rpo"
              value={rpoMinutes}
              onChange={(e) => setRpoMinutes(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="bk-rto">RTO (minutes)</Label>
            <Input
              id="bk-rto"
              value={rtoMinutes}
              onChange={(e) => setRtoMinutes(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="bk-ret">Retention (days)</Label>
            <Input
              id="bk-ret"
              value={retentionDays}
              onChange={(e) => setRetentionDays(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={createBackup.isPending}>
              {createBackup.isPending ? "Backing up…" : "Create backup"}
            </Button>
          </div>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Policies
        </h2>
        {dashboard.isLoading ? (
          <p className="text-sm text-[var(--tc-muted)]">Loading policies…</p>
        ) : (
          <BackupPolicyTable policies={dashboard.data?.policies ?? []} />
        )}
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Failback
        </h2>
        <form
          className="grid gap-3 rounded border border-[var(--tc-border)] p-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            createFailback.mutate(
              {
                organizationId,
                fromRegionCode: fromRegion,
                toRegionCode: toRegion,
                reason: failbackReason,
              },
              {
                onSuccess: (data) => {
                  setMessage(
                    `Failback ${data.failback.fromRegionCode} → ${data.failback.toRegionCode}`,
                  );
                },
              },
            );
          }}
        >
          <div>
            <Label htmlFor="fb-from">From</Label>
            <Input
              id="fb-from"
              value={fromRegion}
              onChange={(e) => setFromRegion(e.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="fb-to">To (primary)</Label>
            <Input
              id="fb-to"
              value={toRegion}
              onChange={(e) => setToRegion(e.target.value)}
              required
            />
          </div>
          <div className="lg:col-span-2">
            <Label htmlFor="fb-reason">Reason</Label>
            <Input
              id="fb-reason"
              value={failbackReason}
              onChange={(e) => setFailbackReason(e.target.value)}
              required
            />
          </div>
          <div className="flex items-end sm:col-span-2 lg:col-span-4">
            <Button type="submit" disabled={createFailback.isPending}>
              {createFailback.isPending ? "Failing back…" : "Run failback"}
            </Button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Recent backups
        </h2>
        {(dashboard.data?.recentBackups.length ?? 0) === 0 ? (
          <FormHint>No backups yet.</FormHint>
        ) : (
          <ul className="space-y-2">
            {dashboard.data!.recentBackups.slice(0, 8).map((b) => (
              <li
                key={b.id}
                className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{b.id.slice(0, 8)}…</span>
                <span className="text-[var(--tc-muted)]"> · {b.status}</span>
                <span className="font-mono text-xs"> · {b.regionCode}</span>
                <div className="text-xs text-[var(--tc-muted)]">
                  {b.completedAt ? new Date(b.completedAt).toLocaleString() : "—"}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RestoreDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        pending={createRestore.isPending}
        backupJobIdHint={latestBackup?.id}
        regionHint={latestBackup?.regionCode ?? regionCode}
        onRestore={(input) => {
          createRestore.mutate(
            {
              organizationId,
              backupJobId: input.backupJobId,
              targetRegionCode: input.targetRegionCode,
            },
            {
              onSuccess: (data) => {
                setMessage(
                  `Restore completed · RTO ${data.restore.achievedRtoMinutes}m → ${data.restore.targetRegionCode}`,
                );
                setRestoreOpen(false);
              },
            },
          );
        }}
      />
    </AppShellLayout>
  );
}
