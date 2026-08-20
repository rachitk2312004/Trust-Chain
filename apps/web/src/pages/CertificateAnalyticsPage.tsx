import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import {
  CertificateBulkMetrics,
  CertificateDownloadMetrics,
  CertificateMetricsPanel,
  CertificateOpsPanel,
  CertificateTemplateMetrics,
  useCertificateAnalytics,
  useCertificateDownloadAnalytics,
  useCertificateTemplateAnalytics,
} from "../features/certificates";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getCertificateErrorMessage } from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";

export function CertificateAnalyticsPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const analytics = useCertificateAnalytics(organizationId);
  const templates = useCertificateTemplateAnalytics(organizationId);
  const downloads = useCertificateDownloadAnalytics(organizationId);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Certificate analytics" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Certificate analytics"
        description="Issuance, verification, downloads, templates, bulk jobs, and ops tools."
        actions={
          <Link to="/certificates" className="text-sm text-[var(--tc-accent)] hover:underline">
            All certificates
          </Link>
        }
      />

      {analytics.isError ? (
        <FormError>{getCertificateErrorMessage(analytics.error)}</FormError>
      ) : null}

      {analytics.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading analytics…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <CertificateMetricsPanel analytics={analytics.data} />

          <div className="grid gap-4 lg:grid-cols-2">
            <CertificateTemplateMetrics
              templates={templates.data?.templates ?? analytics.data?.templates ?? []}
              unused={templates.data?.unusedActiveTemplates}
            />
            <CertificateBulkMetrics bulk={analytics.data?.bulk} />
          </div>

          <CertificateDownloadMetrics
            downloads={downloads.data?.downloads ?? analytics.data?.downloads}
            rendering={downloads.data?.rendering ?? analytics.data?.rendering}
            process={downloads.data?.process ?? analytics.data?.process}
          />

          <CardVerification analytics={analytics.data} />

          <Can capability="certificates.manage" organizationId={organizationId}>
            <CertificateOpsPanel organizationId={organizationId} />
          </Can>
        </div>
      )}
    </AppShellLayout>
  );
}

function CardVerification({
  analytics,
}: {
  analytics: ReturnType<typeof useCertificateAnalytics>["data"];
}) {
  if (!analytics) return null;
  const v = analytics.verification;
  return (
    <div className="rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-4">
      <h3 className="mb-1 text-base font-semibold">Verifications</h3>
      <p className="mb-3 text-sm text-[var(--tc-muted)]">
        {v.totalEvents} events · {v.valid} valid · {v.invalid} invalid · avg{" "}
        {v.averageVerificationTimeMs != null ? `${v.averageVerificationTimeMs}ms` : "—"}
      </p>
    </div>
  );
}
