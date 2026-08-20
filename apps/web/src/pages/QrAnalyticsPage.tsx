import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
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
import { useQrAnalytics } from "../features/qr/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getQrErrorMessage } from "../lib/qrErrors";
import { useSessionStore } from "../lib/sessionStore";

export function QrAnalyticsPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const analytics = useQrAnalytics(organizationId);

  const totals = useMemo(() => {
    const rows = analytics.data ?? [];
    return rows.reduce(
      (acc, row) => ({
        scans: acc.scans + row.scanCount,
        downloads: acc.downloads + row.downloadCount,
        valid: acc.valid + row.validCount,
        invalid: acc.invalid + row.invalidCount,
        revoked: acc.revoked + row.revokedCount,
        expired: acc.expired + row.expiredCount,
        errors: acc.errors + row.errorCount,
      }),
      {
        scans: 0,
        downloads: 0,
        valid: 0,
        invalid: 0,
        revoked: 0,
        expired: 0,
        errors: 0,
      },
    );
  }, [analytics.data]);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="QR analytics" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="QR analytics"
        description="Daily scan and download aggregates (last 30 days)."
        actions={
          <Link to="/qr" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {analytics.isError ? <FormError>{getQrErrorMessage(analytics.error)}</FormError> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>Scans</CardTitle>
            <CardDescription>{totals.scans}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Downloads</CardTitle>
            <CardDescription>{totals.downloads}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Valid</CardTitle>
            <CardDescription>{totals.valid}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Errors / revoked / expired</CardTitle>
            <CardDescription>
              {totals.errors} / {totals.revoked} / {totals.expired}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>

      {analytics.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading analytics…</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Day</TH>
              <TH>Scans</TH>
              <TH>Downloads</TH>
              <TH>Valid</TH>
              <TH>Invalid</TH>
              <TH>Errors</TH>
            </TR>
          </THead>
          <TBody>
            {(analytics.data ?? []).map((row) => (
              <TR key={row.id}>
                <TD>{new Date(row.day).toLocaleDateString()}</TD>
                <TD>{row.scanCount}</TD>
                <TD>{row.downloadCount}</TD>
                <TD>{row.validCount}</TD>
                <TD>{row.invalidCount}</TD>
                <TD>{row.errorCount}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {!analytics.isLoading && (analytics.data?.length ?? 0) === 0 ? (
        <FormHint>No analytics rows yet.</FormHint>
      ) : null}
    </AppShellLayout>
  );
}
