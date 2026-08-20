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
  Select,
} from "@trustchain/ui";
import { Can } from "../components/Can";
import {
  CertificatePreview,
  RevokeCertificateDialog,
  useCertificate,
  useCertificateDownload,
  useVerifyCertificate,
} from "../features/certificates";
import { useFeedback } from "../hooks/useFeedback";
import {
  getCertificateErrorMessage,
  verificationReasonLabel,
} from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { CertificateExportFormat } from "../types/api";

export function CertificateDetailPage() {
  const { certificateId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const certificate = useCertificate(organizationId, certificateId);
  const verify = useVerifyCertificate(organizationId ?? "");
  const download = useCertificateDownload(organizationId ?? "");
  const feedback = useFeedback();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [format, setFormat] = useState<CertificateExportFormat>("pdf");
  const [downloadWarnings, setDownloadWarnings] = useState<string[]>([]);

  if (certificate.isLoading || !certificate.data) {
    return <p className="text-sm text-[var(--tc-muted)]">Loading certificate…</p>;
  }

  const data = certificate.data;
  const canRevoke = data.status === "issued";

  function triggerDownload() {
    download.mutate(
      {
        certificateId,
        format,
        publicId: data.publicId,
      },
      {
        onSuccess: (result) => {
          setDownloadWarnings(result.warnings);
          const url = URL.createObjectURL(result.blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = result.fileName;
          link.click();
          URL.revokeObjectURL(url);
          if (result.warnings.length) {
            feedback.warning("Downloaded with warnings", result.warnings.join("; "));
          } else {
            feedback.success(`Downloaded ${result.fileName}`);
          }
        },
        onError: (err) => feedback.error(err, "Download failed"),
      },
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Can capability="certificates.manage" organizationId={organizationId ?? undefined}>
          {canRevoke ? (
            <Button size="sm" variant="danger" onClick={() => setRevokeOpen(true)}>
              Revoke
            </Button>
          ) : null}
        </Can>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Rendered PNG preview</CardDescription>
          </CardHeader>
          <CertificatePreview
            organizationId={organizationId!}
            certificateId={certificateId}
            publicId={data.publicId}
          />
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Recipient and integrity metadata</CardDescription>
            </CardHeader>
            <dl className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-2 text-sm">
              <dt className="text-[var(--tc-muted)]">Recipient</dt>
              <dd>{data.recipient.name}</dd>
              <dt className="text-[var(--tc-muted)]">Email</dt>
              <dd>{data.recipient.email ?? "—"}</dd>
              <dt className="text-[var(--tc-muted)]">Issued</dt>
              <dd>{data.issuedAt ? new Date(data.issuedAt).toLocaleString() : "—"}</dd>
              <dt className="text-[var(--tc-muted)]">Expires</dt>
              <dd>{data.expiresAt ? new Date(data.expiresAt).toLocaleString() : "—"}</dd>
              <dt className="text-[var(--tc-muted)]">Integrity</dt>
              <dd className="break-all font-mono text-xs">{data.integrityHash}</dd>
              <dt className="text-[var(--tc-muted)]">Verification URL</dt>
              <dd className="break-all">
                <a
                  href={data.verificationUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[var(--tc-accent)] hover:underline"
                >
                  {data.verificationUrl}
                </a>
              </dd>
              <dt className="text-[var(--tc-muted)]">Document</dt>
              <dd>
                {data.documentId ? (
                  <Link
                    to={`/documents/${data.documentId}`}
                    className="text-[var(--tc-accent)] hover:underline"
                  >
                    Open document
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              <dt className="text-[var(--tc-muted)]">QR</dt>
              <dd>
                {data.qrPublicCode ? (
                  <Link
                    to={`/qr/${encodeURIComponent(data.qrPublicCode)}`}
                    className="text-[var(--tc-accent)] hover:underline"
                  >
                    {data.qrPublicCode}
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
              {data.revokedAt ? (
                <>
                  <dt className="text-[var(--tc-muted)]">Revoked</dt>
                  <dd>{new Date(data.revokedAt).toLocaleString()}</dd>
                  <dt className="text-[var(--tc-muted)]">Reason</dt>
                  <dd>{data.revokeReason ?? "—"}</dd>
                </>
              ) : null}
            </dl>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Download</CardTitle>
              <CardDescription>PDF, PNG, or SVG export</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={format}
                onChange={(e) => setFormat(e.target.value as CertificateExportFormat)}
                aria-label="Download format"
              >
                <option value="pdf">PDF</option>
                <option value="png">PNG</option>
                <option value="svg">SVG</option>
              </Select>
              <Button size="sm" disabled={download.isPending} onClick={triggerDownload}>
                {download.isPending ? "Preparing…" : "Download"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={verify.isPending}
                onClick={() =>
                  verify.mutate(certificateId, {
                    onSuccess: (result) =>
                      feedback.success(
                        result.verification.valid ? "Certificate valid" : "Certificate invalid",
                      ),
                    onError: (err) => feedback.error(err, "Verification failed"),
                  })
                }
              >
                {verify.isPending ? "Verifying…" : "Quick verify"}
              </Button>
            </div>
            {downloadWarnings.length ? (
              <div className="mt-2">
                <FormHint>Warnings: {downloadWarnings.join("; ")}</FormHint>
              </div>
            ) : null}
            <FormError>
              {download.error
                ? getCertificateErrorMessage(download.error)
                : verify.error
                  ? getCertificateErrorMessage(verify.error)
                  : null}
            </FormError>
            {verify.data ? (
              <div className="mt-3 rounded border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3 text-sm">
                <div className="mb-2 flex items-center gap-2">
                  <Badge tone={verify.data.verification.valid ? "success" : "danger"}>
                    {verify.data.verification.valid ? "valid" : "invalid"}
                  </Badge>
                  <span className="text-[var(--tc-muted)]">{verify.data.verification.status}</span>
                </div>
                <ul className="list-inside list-disc text-xs text-[var(--tc-muted)]">
                  <li>Integrity: {String(verify.data.verification.checks.integrity)}</li>
                  <li>Not revoked: {String(verify.data.verification.checks.notRevoked)}</li>
                  <li>Not expired: {String(verify.data.verification.checks.notExpired)}</li>
                  <li>Document OK: {String(verify.data.verification.checks.documentOk)}</li>
                </ul>
                {verify.data.verification.reasons.length ? (
                  <p className="mt-2 text-xs">
                    Reasons:{" "}
                    {verify.data.verification.reasons.map(verificationReasonLabel).join(", ")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      {organizationId ? (
        <RevokeCertificateDialog
          organizationId={organizationId}
          certificateId={certificateId}
          publicId={data.publicId}
          open={revokeOpen}
          onClose={() => setRevokeOpen(false)}
          onRevoked={() => feedback.success("Certificate revoked")}
        />
      ) : null}
    </>
  );
}
