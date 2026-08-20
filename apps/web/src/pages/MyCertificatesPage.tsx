import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Copy, Download, ExternalLink } from "lucide-react";
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
import { PageHeader } from "../components/PageHeader";
import { VirtualizedTable } from "../components/VirtualizedTable";
import { useMyCertificateDownload, useMyCertificates } from "../features/wallet/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { certificateStatusTone, getCertificateErrorMessage } from "../lib/certificateErrors";

export function MyCertificatesPage() {
  const feedback = useFeedback();
  const download = useMyCertificateDownload();
  const list = useMyCertificates({ limit: 100 });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const rows = useMemo(() => list.data?.certificates ?? [], [list.data]);

  async function handleDownload(certificateId: string, publicId: string) {
    try {
      const result = await download.mutateAsync({ certificateId, format: "pdf" });
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.fileName || `${publicId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      if (result.warnings.length) {
        feedback.info(`Downloaded with warnings: ${result.warnings.join(", ")}`);
      } else {
        feedback.success("Certificate downloaded");
      }
    } catch (error) {
      feedback.error(error, "Could not download certificate");
    }
  }

  async function handleCopyVerifyUrl(verificationUrl: string, certificateId: string) {
    try {
      await navigator.clipboard.writeText(verificationUrl);
      setCopiedId(certificateId);
      feedback.success("Verification link copied");
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      feedback.error(null, "Could not copy link");
    }
  }

  return (
    <>
      <PageHeader
        title="My certificates"
        description="Credentials issued to you by organizations on TrustChain."
      />

      {list.isError ? (
        <FormError>{getCertificateErrorMessage(list.error)}</FormError>
      ) : null}
      {list.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading your certificates…</p>
      ) : null}

      {!list.isLoading && rows.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-emerald-400" />
              No certificates yet
            </CardTitle>
            <CardDescription>
              When an organization issues a certificate to your account, it will appear here.
              Use <strong>Join org</strong> in the top bar to request access to your employer or
              school, or accept an invitation they send you.
            </CardDescription>
          </CardHeader>
          <FormHint>
            Need to verify someone else&apos;s document?{" "}
            <Link to="/verify" className="text-[var(--tc-accent)] hover:underline">
              Public verification
            </Link>
          </FormHint>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <VirtualizedTable
          rows={rows}
          getRowKey={(cert) => cert.id}
          header={
            <>
              <TH>Title</TH>
              <TH>Public ID</TH>
              <TH>Status</TH>
              <TH>Issued</TH>
              <TH className="text-right">Actions</TH>
            </>
          }
          renderRow={(cert) => (
            <>
              <TD>{cert.title}</TD>
              <TD className="font-mono text-xs">{cert.publicId}</TD>
              <TD>
                <Badge tone={certificateStatusTone(cert.status)}>{cert.status}</Badge>
              </TD>
              <TD>{cert.issuedAt ? new Date(cert.issuedAt).toLocaleDateString() : "—"}</TD>
              <TD className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={download.isPending}
                    onClick={() => void handleDownload(cert.id, cert.publicId)}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleCopyVerifyUrl(cert.verificationUrl, cert.id)}
                  >
                    <Copy className="mr-1 h-4 w-4" />
                    {copiedId === cert.id ? "Copied" : "Share"}
                  </Button>
                  <a
                    href={cert.verificationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center rounded-md px-3 text-sm text-[var(--tc-fg)] hover:bg-[var(--tc-surface-2)]"
                  >
                    <ExternalLink className="mr-1 h-4 w-4" />
                    Verify
                  </a>
                </div>
              </TD>
            </>
          )}
        />
      ) : null}
    </>
  );
}
