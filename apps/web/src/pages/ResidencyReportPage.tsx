import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { ResidencyCard, useResidencyReport } from "../features/regions";

export function ResidencyReportPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const report = useResidencyReport(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Residency report" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Residency report" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Residency compliance"
        description="Home region, locked data classes, replication/failover alignment."
        actions={
          <Link to="/regions" className="text-sm text-[var(--tc-accent)] hover:underline">
            Regions
          </Link>
        }
      />

      {report.isError ? <FormError>{getApiErrorMessage(report.error)}</FormError> : null}

      {report.isLoading || !report.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading residency report…</p>
      ) : (
        <div className="space-y-8">
          <ResidencyCard report={report.data} />

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Locked classes
            </h2>
            <p className="font-mono text-sm">
              {report.data.report.lockedClasses.join(", ") || "—"}
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Replication
            </h2>
            <p className="text-sm">
              mode <span className="font-mono">{report.data.replication.mode}</span> · targets{" "}
              <span className="font-mono">
                {report.data.replication.targets.join(", ") || "none"}
              </span>
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Recent failovers
            </h2>
            {report.data.recentFailovers.length === 0 ? (
              <FormHint>No failover events.</FormHint>
            ) : (
              <ul className="space-y-2">
                {report.data.recentFailovers.map((e) => (
                  <li
                    key={e.id}
                    className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
                  >
                    <span className="font-mono">
                      {e.fromRegionCode} → {e.toRegionCode}
                    </span>
                    <span className="text-[var(--tc-muted)]"> · {e.reason}</span>
                    <div className="text-xs text-[var(--tc-muted)]">
                      {new Date(e.createdAt).toLocaleString()}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}
