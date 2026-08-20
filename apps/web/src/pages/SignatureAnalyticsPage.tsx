import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import {
  SignatureAlgorithmMetrics,
  SignatureDetachedMetrics,
  SignatureMetricsPanel,
  SignatureOpsPanel,
  SignatureVerificationMetrics,
  SignatureWorkflowMetrics,
  useSignatureAnalytics,
  useSignatureAlgorithmAnalytics,
  useSignatureDetachedAnalytics,
  useSignatureVerificationAnalytics,
  useSignatureWorkflowAnalytics,
} from "../features/signatures";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getSignatureErrorMessage } from "../lib/signatureErrors";
import { useSessionStore } from "../lib/sessionStore";

export function SignatureAnalyticsPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const analytics = useSignatureAnalytics(organizationId);
  const workflows = useSignatureWorkflowAnalytics(organizationId);
  const algorithms = useSignatureAlgorithmAnalytics(organizationId);
  const verifications = useSignatureVerificationAnalytics(organizationId);
  const detached = useSignatureDetachedAnalytics(organizationId);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Signature analytics" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Signature analytics"
        description="Lifecycle, algorithms, workflows, verifications, detached stats, and ops tools."
        actions={
          <Link to="/signatures" className="text-sm text-[var(--tc-accent)] hover:underline">
            All signatures
          </Link>
        }
      />

      {analytics.isError ? (
        <FormError>{getSignatureErrorMessage(analytics.error)}</FormError>
      ) : null}

      {analytics.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading analytics…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <SignatureMetricsPanel analytics={analytics.data} />

          <div className="grid gap-4 lg:grid-cols-2">
            <SignatureWorkflowMetrics
              workflows={workflows.data?.workflows ?? analytics.data?.workflows}
              processAverageApprovalMs={
                workflows.data?.process.averageApprovalTimeMs ??
                analytics.data?.process.averageApprovalTimeMs
              }
            />
            <SignatureAlgorithmMetrics
              algorithms={algorithms.data?.algorithms ?? analytics.data?.algorithms}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SignatureVerificationMetrics
              verification={
                verifications.data?.verification ?? analytics.data?.verification
              }
              process={verifications.data?.process ?? analytics.data?.process}
            />
            <SignatureDetachedMetrics
              detached={detached.data?.detached ?? analytics.data?.detached}
              downloads={detached.data?.downloads ?? analytics.data?.downloads}
            />
          </div>

          <Can capability="signatures.manage" organizationId={organizationId}>
            <SignatureOpsPanel organizationId={organizationId} />
          </Can>
        </div>
      )}
    </AppShellLayout>
  );
}
