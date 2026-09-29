import { Link, useNavigate } from "react-router-dom";
import { FileSpreadsheet, FileUp } from "lucide-react";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { Card, StatCard } from "../components/ui";
import { VerificationReportTable } from "../features/verification/VerificationReportTable";
import { useCheckHistory, useVerificationStatistics } from "../features/verification/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { rowsFromCheckHistory } from "../lib/verificationReport";
import { getVerificationErrorMessage } from "../lib/verifyErrors";
import { PlanGate } from "../features/billing/PlanGate";
import { useSessionStore } from "../lib/sessionStore";
import { getWorkspacePersona } from "../lib/workspacePersona";

export function VerificationPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const roles = useSessionStore((s) => s.roles);
  const persona = getWorkspacePersona(roles, organizationId);
  const employee = persona.kind === "employee";
  const stats = useVerificationStatistics(organizationId);
  const recent = useCheckHistory(organizationId, { limit: 8, offset: 0 });
  const reportRows = rowsFromCheckHistory(recent.data?.rows ?? []);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Verification" description="Check PDFs and CERT ID lists." />
        <FormHint>
          Select an organization in the switcher, or{" "}
          <Link to="/organizations" className="text-[var(--tc-accent)] hover:underline">
            create one
          </Link>
          .
        </FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title={employee ? "Verify certificates" : "Verification"}
        description="Check applicant PDFs, or a CSV of CERT IDs and names. Public visitors only paste a URL or QR."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/verification/upload")}>Check PDFs</Button>
            <Button variant="secondary" onClick={() => navigate("/verification/bulk")}>
              CERT ID CSV
            </Button>
            <Button variant="ghost" onClick={() => navigate("/verification/history")}>
              History
            </Button>
          </div>
        }
      />

      <PlanGate feature="org_verification" organizationId={organizationId}>
      {stats.isError ? (
        <FormError>{getVerificationErrorMessage(stats.error)}</FormError>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Checks" value={stats.data?.total ?? "—"} />
        <StatCard label="Valid rate" value={stats.data ? `${stats.data.validRate}%` : "—"} />
        <StatCard label="Valid" value={stats.data?.byOutcome.valid ?? 0} tone="success" />
        <StatCard
          label="Copied / not issued"
          value={
            stats.data
              ? Math.max(
                  0,
                  stats.data.total -
                    (stats.data.byOutcome.valid ?? 0),
                )
              : 0
          }
          tone="error"
        />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card hover className="flex flex-col">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-tc-accent-soft text-tc-accent">
            <FileUp className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-semibold text-tc-fg">PDF files</h2>
          <p className="mt-2 text-sm text-tc-fg">Drop one PDF or many. We read the CERT ID and the name on the file.</p>
          <p className="mt-1 text-sm text-tc-muted">
            If someone uploads another person’s real certificate, the table shows the applicant name and the real holder.
            Random files return <span className="font-medium">Not issued</span>.
          </p>
          <p className="mt-2 font-mono text-xs text-tc-muted">Optional CSV column: file, name</p>
          <div className="mt-4">
            <Button size="sm" onClick={() => navigate("/verification/upload")}>
              Check PDFs
            </Button>
          </div>
        </Card>
        <Card hover className="flex flex-col">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-tc-accent-soft text-tc-accent">
            <FileSpreadsheet className="h-5 w-5" aria-hidden />
          </div>
          <h2 className="font-display text-lg font-semibold text-tc-fg">CERT ID CSV</h2>
          <p className="mt-2 text-sm text-tc-fg">
            Upload a spreadsheet with <span className="font-mono">cert_id</span> and{" "}
            <span className="font-mono">name</span>.
          </p>
          <p className="mt-1 text-sm text-tc-muted">
            We match the CERT ID to the issued holder. A copied ID with a different name is flagged with both names.
          </p>
          <p className="mt-2 font-mono text-xs text-tc-muted">cert_id,name<br />CERT-MTTBIU71-CEB87247,Aditya</p>
          <div className="mt-4">
            <Button size="sm" onClick={() => navigate("/verification/bulk")}>
              Upload CSV
            </Button>
          </div>
        </Card>
      </div>

      {recent.isError ? (
        <FormError>{getVerificationErrorMessage(recent.error)}</FormError>
      ) : null}

      {recent.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading recent checks…</p>
      ) : (
        <VerificationReportTable
          title="Recent checks"
          rows={reportRows}
          empty="No checks yet. Drop PDFs or upload a CERT ID CSV."
        />
      )}
      </PlanGate>
    </AppShellLayout>
  );
}
