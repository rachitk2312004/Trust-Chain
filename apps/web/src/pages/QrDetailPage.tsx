import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { Can } from "../components/Can";
import { DownloadQrDialog } from "../features/qr/DownloadQrDialog";
import { RevokeQrDialog } from "../features/qr/RevokeQrDialog";
import {
  usePublicQrScan,
  useQrCode,
  useQrPreview,
  useUpdateQr,
} from "../features/qr/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  extractQrScanToken,
  getQrErrorMessage,
  qrStatusTone,
  scanUrlFromPayload,
} from "../lib/qrErrors";
import { useSessionStore } from "../lib/sessionStore";
import { OutcomeBadge } from "../features/verification/VerificationResultPanels";
import { useFeedback } from "../hooks/useFeedback";

export function QrDetailPage() {
  const { qrId = "" } = useParams();
  const publicCode = decodeURIComponent(qrId);
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const qr = useQrCode(organizationId, publicCode);
  const preview = useQrPreview(organizationId, publicCode);
  const update = useUpdateQr(organizationId ?? "");
  const publicScan = usePublicQrScan();
  const feedback = useFeedback();
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="QR code" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (qr.isError) {
    return (
      <AppShellLayout>
        <PageHeader title="QR code" />
        <FormError>{getQrErrorMessage(qr.error)}</FormError>
      </AppShellLayout>
    );
  }

  if (qr.isLoading || !qr.data) {
    return (
      <AppShellLayout>
        <PageHeader title="QR code" />
        <p className="text-sm text-[var(--tc-muted)]">Loading…</p>
      </AppShellLayout>
    );
  }

  const data = qr.data;
  const scanUrl = scanUrlFromPayload(data.payload);
  const token = scanUrl ? extractQrScanToken(scanUrl) : null;
  const previewSrc = preview.data ?? null;

  return (
    <AppShellLayout>
      <PageHeader
        title={data.publicCode}
        description={`${data.formatVersion} · document ${data.documentId}`}
        actions={
          <Link to="/qr" className="text-sm text-[var(--tc-accent)] hover:underline">
            All QR codes
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={qrStatusTone(data.status)}>{data.status}</Badge>
        <Badge tone="neutral">{data.visibility}</Badge>
        <Button size="sm" variant="secondary" onClick={() => setDownloadOpen(true)}>
          Download
        </Button>
        <Can capability="qr.manage" organizationId={organizationId}>
          {data.status === "active" ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                disabled={update.isPending}
                onClick={() =>
                  update.mutate(
                    { publicCode },
                    {
                      onSuccess: () => feedback.success("QR rotated"),
                      onError: (err) => feedback.error(err, "Rotate failed"),
                    },
                  )
                }
              >
                {update.isPending ? "Rotating…" : "Rotate / update"}
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRevokeOpen(true)}>
                Revoke
              </Button>
            </>
          ) : null}
        </Can>
        {token ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={publicScan.isPending}
            onClick={() =>
              publicScan.mutate(token, {
                onSuccess: () => feedback.success("Public verification complete"),
                onError: (err) => feedback.error(err, "Verification failed"),
              })
            }
          >
            {publicScan.isPending ? "Verifying…" : "Verify public link"}
          </Button>
        ) : null}
      </div>

      <FormError>
        {update.error
          ? getQrErrorMessage(update.error)
          : publicScan.error
            ? getQrErrorMessage(publicScan.error)
            : preview.error
              ? getQrErrorMessage(preview.error)
              : null}
      </FormError>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Cached rendered QR asset</CardDescription>
          </CardHeader>
          <div className="flex min-h-64 items-center justify-center rounded bg-[var(--tc-surface-2)] p-4">
            {preview.isLoading ? (
              <span className="text-sm text-[var(--tc-muted)]">Loading preview…</span>
            ) : previewSrc ? (
              <img src={previewSrc} alt={data.publicCode} className="max-h-72 max-w-full" />
            ) : (
              <span className="text-sm text-[var(--tc-muted)]">Preview unavailable</span>
            )}
          </div>
          {scanUrl ? (
            <p className="mt-3 break-all text-xs text-[var(--tc-muted)]">
              Public verification link:{" "}
              <a
                href={scanUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[var(--tc-accent)] hover:underline"
              >
                {scanUrl}
              </a>
            </p>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
            <CardDescription>Integrity and payload fields</CardDescription>
          </CardHeader>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-2 text-sm">
            <dt className="text-[var(--tc-muted)]">Issued</dt>
            <dd>{new Date(data.issuedAt).toLocaleString()}</dd>
            <dt className="text-[var(--tc-muted)]">Expires</dt>
            <dd>{data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "—"}</dd>
            <dt className="text-[var(--tc-muted)]">Algorithm</dt>
            <dd>{data.integrity.algorithm}</dd>
            <dt className="text-[var(--tc-muted)]">Payload hash</dt>
            <dd className="break-all font-mono text-xs">{data.integrity.payloadHash}</dd>
            <dt className="text-[var(--tc-muted)]">Checksum</dt>
            <dd className="break-all font-mono text-xs">{data.integrity.payloadChecksum}</dd>
            <dt className="text-[var(--tc-muted)]">Document</dt>
            <dd>
              <Link
                to={`/documents/${data.documentId}`}
                className="text-[var(--tc-accent)] hover:underline"
              >
                Open document
              </Link>
            </dd>
          </dl>
          {data.payload ? (
            <pre className="mt-4 max-h-64 overflow-auto rounded bg-[var(--tc-surface-2)] p-3 text-xs">
              {JSON.stringify(data.payload, null, 2)}
            </pre>
          ) : null}
        </Card>
      </div>

      {publicScan.data ? (
        <div className="mt-6">
          <div className="mb-2 flex items-center gap-2">
            <OutcomeBadge outcome={publicScan.data.report.verificationResult} />
            <span className="text-sm text-[var(--tc-muted)]">Public QR verification result</span>
          </div>
          <pre className="overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
            {JSON.stringify(publicScan.data.report, null, 2)}
          </pre>
        </div>
      ) : null}

      <DownloadQrDialog
        organizationId={organizationId}
        publicCode={publicCode}
        open={downloadOpen}
        onClose={() => setDownloadOpen(false)}
      />
      <RevokeQrDialog
        organizationId={organizationId}
        publicCode={publicCode}
        open={revokeOpen}
        onClose={() => setRevokeOpen(false)}
      />
    </AppShellLayout>
  );
}
