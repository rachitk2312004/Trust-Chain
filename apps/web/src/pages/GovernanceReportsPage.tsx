import { Link } from "react-router-dom";
import { Badge, FormError, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import { useGovernanceReports } from "../features/governance";

export function GovernanceReportsPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const reports = useGovernanceReports(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Executive reports" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Executive reports" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Executive governance reports"
        description="Continuity of policy ownership, risk portfolio, and control coverage over time."
        actions={
          <Link to="/governance" className="text-sm text-[var(--tc-accent)] hover:underline">
            Governance
          </Link>
        }
      />

      {reports.isError ? <FormError>{getApiErrorMessage(reports.error)}</FormError> : null}

      {reports.isLoading || !reports.data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading executive reports…</p>
      ) : (
        <div className="space-y-6">
          <div className="rounded border border-[var(--tc-border)] p-4">
            <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
              Latest snapshot
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-3xl font-semibold">
                {Math.round(reports.data.latest.score * 100)}%
              </span>
              <Badge tone={reports.data.latest.score >= 0.65 ? "success" : "danger"}>
                executive
              </Badge>
            </div>
            <p className="mt-2 text-xs text-[var(--tc-muted)]">
              {new Date(reports.data.latest.createdAt).toLocaleString()}
            </p>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Score</TH>
                <TH>Created</TH>
                <TH>ID</TH>
              </TR>
            </THead>
            <TBody>
              {reports.data.reports.map((r) => (
                <TR key={r.id}>
                  <TD>
                    <Badge tone={r.score >= 0.65 ? "success" : r.score >= 0.4 ? "neutral" : "danger"}>
                      {Math.round(r.score * 100)}%
                    </Badge>
                  </TD>
                  <TD className="text-xs">{new Date(r.createdAt).toLocaleString()}</TD>
                  <TD className="font-mono text-xs">{r.id.slice(0, 8)}…</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </AppShellLayout>
  );
}
