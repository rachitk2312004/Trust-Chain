import { Link } from "react-router-dom";
import { Badge, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { ComplianceScoreCard, useComplianceReports } from "../features/compliance";

export function ComplianceReportPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const reports = useComplianceReports(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Compliance reports" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Compliance reports" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Compliance reports"
        description="Generated assessment reports for regulatory frameworks."
        actions={
          <Link to="/compliance" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {reports.isError ? <FormError>{getApiErrorMessage(reports.error)}</FormError> : null}
      {reports.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading reports…</p>
      ) : (
        <div className="space-y-4">
          {(reports.data?.reports ?? []).length === 0 ? (
            <FormHint>No reports yet. Run a compliance check from the dashboard.</FormHint>
          ) : (
            (reports.data?.reports ?? []).map((report) => {
              const payload = report.report as {
                summary?: string;
                score?: { grade?: string };
                violations?: unknown[];
              };
              return (
                <article
                  key={report.id}
                  className="rounded border border-[var(--tc-border)] p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{report.title}</h2>
                    <Badge tone="neutral">{report.framework}</Badge>
                    <Badge tone="neutral">{report.status}</Badge>
                    <span className="text-xs text-[var(--tc-muted)]">
                      {new Date(report.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="mb-3 max-w-xs">
                    <ComplianceScoreCard
                      label="Assessment score"
                      score={report.score}
                      grade={payload.score?.grade}
                    />
                  </div>
                  {payload.summary ? (
                    <p className="text-sm text-[var(--tc-muted)]">{payload.summary}</p>
                  ) : null}
                  {Array.isArray(payload.violations) ? (
                    <p className="mt-2 text-xs text-[var(--tc-muted)]">
                      {payload.violations.length} violation(s) in report
                    </p>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      )}
    </AppShellLayout>
  );
}
