import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
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
  TD,
  TH,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import { PageHeader } from "../components/PageHeader";
import { VirtualizedTable } from "../components/VirtualizedTable";
import { CreateQrDialog } from "../features/qr/CreateQrDialog";
import { qrKeys, useQrAnalytics, useQrCodes } from "../features/qr/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getQrErrorMessage, qrStatusTone, scanUrlFromPayload } from "../lib/qrErrors";
import { useSessionStore } from "../lib/sessionStore";
import { qrApi } from "../services/qrApi";

export function QrPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const feedback = useFeedback();
  const qrs = useQrCodes(organizationId);
  const analytics = useQrAnalytics(organizationId);
  const [createOpen, setCreateOpen] = useState(false);
  const [view, setView] = useState<"table" | "gallery">("table");

  const totals = useMemo(() => {
    const rows = analytics.data ?? [];
    return rows.reduce(
      (acc, row) => ({
        scans: acc.scans + row.scanCount,
        downloads: acc.downloads + row.downloadCount,
        valid: acc.valid + row.validCount,
        errors: acc.errors + row.errorCount,
      }),
      { scans: 0, downloads: 0, valid: 0, errors: 0 },
    );
  }, [analytics.data]);

  const galleryCodes = (qrs.data ?? []).slice(0, 12);
  const previewQueries = useQueries({
    queries: galleryCodes.map((qr) => ({
      queryKey: qrKeys(organizationId ?? undefined, qr.publicCode).preview(qr.publicCode, "base64"),
      queryFn: async () => {
        const response = await qrApi.download(organizationId!, qr.publicCode, "base64");
        const body = response.data as unknown as { pngBase64: string };
        return body.pngBase64 ? `data:image/png;base64,${body.pngBase64}` : null;
      },
      enabled: view === "gallery" && Boolean(organizationId),
      staleTime: 10 * 60_000,
      gcTime: 30 * 60_000,
    })),
  });

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="QR codes" description="Organization QR dashboard." />
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

  const rows = qrs.data ?? [];

  return (
    <AppShellLayout>
      <PageHeader
        title="QR codes"
        description="Generate signed QR payloads, preview assets, and manage lifecycle."
        actions={
          <div className="flex flex-wrap gap-2">
            <Can capability="qr.manage" organizationId={organizationId}>
              <Button onClick={() => setCreateOpen(true)}>Generate QR</Button>
            </Can>
            <Button variant="secondary" onClick={() => navigate("/qr/templates")}>
              Templates
            </Button>
            <Can capability="qr.analytics" organizationId={organizationId}>
              <Button variant="ghost" onClick={() => navigate("/qr/analytics")}>
                Analytics
              </Button>
            </Can>
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>QR codes</CardTitle>
            <CardDescription>{qrs.data?.length ?? "—"}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Scans (30d)</CardTitle>
            <CardDescription>{analytics.isLoading ? "—" : totals.scans}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Downloads</CardTitle>
            <CardDescription>{analytics.isLoading ? "—" : totals.downloads}</CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Valid scans</CardTitle>
            <CardDescription>{analytics.isLoading ? "—" : totals.valid}</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Button
          size="sm"
          variant={view === "table" ? "primary" : "secondary"}
          onClick={() => setView("table")}
        >
          Table
        </Button>
        <Button
          size="sm"
          variant={view === "gallery" ? "primary" : "secondary"}
          onClick={() => setView("gallery")}
        >
          Gallery
        </Button>
        <Link to="/qr/history" className="text-[var(--tc-accent)] hover:underline">
          Scan history
        </Link>
      </div>

      {qrs.isError ? <FormError>{getQrErrorMessage(qrs.error)}</FormError> : null}

      {qrs.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading QR codes…</p>
      ) : view === "table" ? (
        <VirtualizedTable
          rows={rows}
          getRowKey={(qr) => qr.publicCode}
          header={
            <>
              <TH>Code</TH>
              <TH>Document</TH>
              <TH>Format</TH>
              <TH>Status</TH>
              <TH>Issued</TH>
            </>
          }
          empty={<FormHint>No QR codes yet. Generate one for a document.</FormHint>}
          renderRow={(qr) => (
            <>
              <TD>
                <Link
                  to={`/qr/${encodeURIComponent(qr.publicCode)}`}
                  className="font-medium text-[var(--tc-accent)] hover:underline"
                >
                  {qr.publicCode}
                </Link>
              </TD>
              <TD>
                <Link
                  to={`/documents/${qr.documentId}`}
                  className="text-[var(--tc-accent)] hover:underline"
                >
                  Open document
                </Link>
              </TD>
              <TD>{qr.formatVersion}</TD>
              <TD>
                <Badge tone={qrStatusTone(qr.status)}>{qr.status}</Badge>
              </TD>
              <TD>{new Date(qr.issuedAt).toLocaleString()}</TD>
            </>
          )}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {galleryCodes.map((qr, index) => (
            <Link
              key={qr.publicCode}
              to={`/qr/${encodeURIComponent(qr.publicCode)}`}
              className="rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 transition hover:border-[var(--tc-accent)]"
            >
              <div className="mb-2 flex aspect-square items-center justify-center rounded bg-[var(--tc-surface-2)]">
                {previewQueries[index]?.data ? (
                  <img
                    src={previewQueries[index]!.data!}
                    alt={qr.publicCode}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-[var(--tc-muted)]">
                    {previewQueries[index]?.isLoading ? "Preview…" : "No preview"}
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{qr.publicCode}</span>
                <Badge tone={qrStatusTone(qr.status)}>{qr.status}</Badge>
              </div>
              {scanUrlFromPayload(qr.payload) ? (
                <p className="mt-1 truncate text-xs text-[var(--tc-muted)]">
                  {scanUrlFromPayload(qr.payload)}
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}

      <CreateQrDialog
        organizationId={organizationId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(code) => {
          feedback.success("QR code generated");
          navigate(`/qr/${encodeURIComponent(code)}`);
        }}
      />
    </AppShellLayout>
  );
}
