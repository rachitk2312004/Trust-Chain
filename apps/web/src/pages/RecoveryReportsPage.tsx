import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { ContinuityReportPanel, useRecoveryReports } from "../features/recovery";

export function RecoveryReportsPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const reports = useRecoveryReports(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Continuity reports" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Continuity reports" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Continuity reports"
        description="RPO/RTO adherence and backup success scoring over time."
        actions={
          <Link to="/recovery" className="text-sm text-[var(--tc-accent)] hover:underline">
            Recovery
          </Link>
        }
      />

      {reports.isError ? <FormError>{getApiErrorMessage(reports.error)}</FormError> : null}

      {reports.isLoading || !reports.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading continuity reports…</p>
      ) : (
        <ContinuityReportPanel reports={reports.data.reports} latest={reports.data.latest} />
      )}
    </AppShellLayout>
  );
}
