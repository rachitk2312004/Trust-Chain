import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { OutcomeBadge } from "../features/verification/VerificationResultPanels";
import {
  useVerificationHistory,
  useVerificationStatistics,
} from "../features/verification/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getVerificationErrorMessage } from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";

export function VerificationPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const stats = useVerificationStatistics(organizationId);
  const recent = useVerificationHistory(organizationId, { limit: 8, offset: 0 });

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Verification" description="Organization verification dashboard." />
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
        title="Verification"
        description="Integrity checks, public lookups, and verification history."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => navigate("/verification/hash")}>Verify hash</Button>
            <Button variant="secondary" onClick={() => navigate("/verification/upload")}>
              Verify file
            </Button>
            <Button variant="ghost" onClick={() => navigate("/verification/public")}>
              Public verify
            </Button>
          </div>
        }
      />

      {stats.isError ? (
        <FormError>{getVerificationErrorMessage(stats.error)}</FormError>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Total</CardTitle>
            <CardDescription>{stats.data?.total ?? "—"}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Valid rate</CardTitle>
            <CardDescription>{stats.data ? `${stats.data.validRate}%` : "—"}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Valid</CardTitle>
            <CardDescription>{stats.data?.byOutcome.valid ?? 0}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revoked / tampered</CardTitle>
            <CardDescription>
              {(stats.data?.byOutcome.revoked ?? 0) + (stats.data?.byOutcome.tampered ?? 0)}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <Link to="/verification/history" className="text-[var(--tc-accent)] hover:underline">
          Full history
        </Link>
        <Link to="/verification/hash" className="text-[var(--tc-accent)] hover:underline">
          Hash verification
        </Link>
        <Link to="/verification/upload" className="text-[var(--tc-accent)] hover:underline">
          File verification
        </Link>
        <Link to="/verification/public" className="text-[var(--tc-accent)] hover:underline">
          Public / QR-linked lookup
        </Link>
      </div>

      {stats.data && Object.keys(stats.data.byOutcome).length > 0 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(stats.data.byOutcome).map(([outcome, count]) => (
            <Badge key={outcome} tone="neutral">
              {outcome}: {count}
            </Badge>
          ))}
        </div>
      ) : null}

      {recent.isError ? (
        <FormError>{getVerificationErrorMessage(recent.error)}</FormError>
      ) : null}

      {recent.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading recent verifications…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Code</TH>
              <TH>Status</TH>
              <TH>Outcome</TH>
              <TH>Created</TH>
            </TR>
          </THead>
          <TBody>
            {(recent.data?.verifications ?? []).map((item) => (
              <TR key={item.request.id}>
                <TD>
                  <Link
                    to={`/verification/${item.request.id}`}
                    className="font-medium text-[var(--tc-accent)] hover:underline"
                  >
                    {item.request.verificationCode}
                  </Link>
                </TD>
                <TD>{item.request.status}</TD>
                <TD>
                  <OutcomeBadge outcome={item.outcome} />
                </TD>
                <TD>{new Date(item.request.createdAt).toLocaleString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {!recent.isLoading && (recent.data?.verifications.length ?? 0) === 0 ? (
        <FormHint>No verifications yet. Run a hash or file check to get started.</FormHint>
      ) : null}
    </AppShellLayout>
  );
}
