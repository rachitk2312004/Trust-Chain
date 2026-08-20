import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  ComplianceFrameworkCard,
  ComplianceScoreCard,
  ComplianceViolationTable,
  RemediationPanel,
  useCompleteRemediation,
  useComplianceDashboard,
  useRunCompliance,
} from "../features/compliance";

export function ComplianceDashboardPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const dashboard = useComplianceDashboard(organizationId, canManage);
  const run = useRunCompliance();
  const complete = useCompleteRemediation();

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Compliance" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Compliance" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const data = dashboard.data;
  const remediations =
    data?.violations.flatMap((v) =>
      v.remediations
        .filter((r) => r.status !== "completed" && r.status !== "cancelled")
        .map((r) => ({ ...r, violationTitle: v.title })),
    ) ?? [];

  return (
    <AppShellLayout>
      <PageHeader
        title="Compliance"
        description="SOC 2, ISO 27001, GDPR, and HIPAA checks, scores, and remediation."
        actions={
          <Link to="/compliance/reports" className="text-sm text-[var(--tc-accent)] hover:underline">
            Reports
          </Link>
        }
      />

      {dashboard.isError ? <FormError>{getApiErrorMessage(dashboard.error)}</FormError> : null}
      {run.isError ? <FormError>{getApiErrorMessage(run.error)}</FormError> : null}

      {dashboard.isLoading || !data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading compliance…</p>
      ) : (
        <div className="space-y-10">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ComplianceScoreCard label="Overall score" score={data.overallScore} />
            <ComplianceScoreCard
              label="Frameworks covered"
              score={Math.min(1, data.frameworksCovered / 4)}
              subtitle={`${data.frameworksCovered} / 4`}
            />
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
                Open violations
              </div>
              <div className="mt-1 text-3xl font-semibold">{data.openViolations}</div>
            </div>
            <div className="rounded border border-[var(--tc-border)] p-4">
              <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
                Open remediations
              </div>
              <div className="mt-1 text-3xl font-semibold">{data.openRemediations}</div>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Frameworks
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {data.frameworks.map((fw) => (
                <ComplianceFrameworkCard
                  key={fw.id}
                  framework={{
                    ...fw,
                    score: data.latestByFramework[fw.id]?.score,
                  }}
                  running={run.isPending && run.variables?.framework === fw.id}
                  onRun={(frameworkId) =>
                    run.mutate({
                      organizationId,
                      framework: frameworkId,
                      // Foundation demo signals so first runs produce meaningful scores.
                      signals: {
                        mfaEnabledRatio: 0.85,
                        auditEventsLast30d: 25,
                        failedAuditRatio: 0.05,
                        documentRetentionPolicyPresent: 1,
                        encryptionAtRestEnabled: 1,
                        accessReviewsLast90d: 1,
                        dataSubjectRequestProcess: 1,
                        phiAccessLogging: 0,
                        backupVerifiedLast30d: 1,
                        incidentResponsePlanPresent: 1,
                        vendorRiskAssessed: 0,
                        leastPrivilegeEnforced: 1,
                      },
                    })
                  }
                />
              ))}
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Violations
              </h2>
              <ComplianceViolationTable violations={data.violations} />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Remediation
              </h2>
              <RemediationPanel
                items={remediations}
                pendingId={complete.isPending ? complete.variables?.id : null}
                onComplete={(id) => complete.mutate({ id, organizationId })}
              />
            </div>
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}
