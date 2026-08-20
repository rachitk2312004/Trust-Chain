import { Link, useParams } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  ConfidenceIndicator,
  OutcomeBadge,
  VerificationMetadataViewer,
  VerificationTimeline,
} from "../features/verification/VerificationResultPanels";
import { useVerification } from "../features/verification/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getVerificationErrorMessage, isVerifyNotFound } from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";

export function VerificationDetailPage() {
  const { verificationId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const detail = useVerification(organizationId, verificationId);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Verification" />
        <FormHint>Select an organization to view this verification.</FormHint>
      </AppShellLayout>
    );
  }

  if (detail.isError) {
    return (
      <AppShellLayout>
        <PageHeader title="Verification" />
        <FormError>
          {isVerifyNotFound(detail.error)
            ? "Verification not found."
            : getVerificationErrorMessage(detail.error)}
        </FormError>
      </AppShellLayout>
    );
  }

  if (detail.isLoading || !detail.data) {
    return (
      <AppShellLayout>
        <PageHeader title="Verification" />
        <p className="text-sm text-[var(--tc-muted)]">Loading verification…</p>
      </AppShellLayout>
    );
  }

  const { request, outcome, report } = detail.data;

  return (
    <AppShellLayout>
      <PageHeader
        title={request.verificationCode}
        description={`${request.status} · document ${request.documentId}`}
        actions={
          <Link
            to="/verification/history"
            className="text-sm text-[var(--tc-accent)] hover:underline"
          >
            History
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <OutcomeBadge outcome={outcome ?? report?.verificationResult} />
        <ConfidenceIndicator report={report} />
        <span className="text-sm text-[var(--tc-muted)]">
          Created {new Date(request.createdAt).toLocaleString()}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
            Status timeline & checks
          </h2>
          <VerificationTimeline report={report} status={request.status} />
          {report?.failureReasons?.length ? (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium">Failure reasons</h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--tc-danger)]">
                {report.failureReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <VerificationMetadataViewer report={report} />
      </div>

      <div className="mt-6 text-sm">
        <Link
          to={`/documents/${request.documentId}`}
          className="text-[var(--tc-accent)] hover:underline"
        >
          Open related document
        </Link>
      </div>
    </AppShellLayout>
  );
}
