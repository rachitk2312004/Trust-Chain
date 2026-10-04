import { useParams } from "react-router-dom";
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
import { useCertificate, useVerifyCertificate } from "../features/certificates";
import { useFeedback } from "../hooks/useFeedback";
import {
  certificateStatusTone,
  getCertificateErrorMessage,
  verificationReasonLabel,
} from "../lib/certificateErrors";
import { useSessionStore } from "../lib/sessionStore";

export function CertificateVerificationPage() {
  const { certificateId = "" } = useParams();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const certificate = useCertificate(organizationId, certificateId);
  const verify = useVerifyCertificate(organizationId ?? "");
  const feedback = useFeedback();

  if (!organizationId) {
    return <FormHint>Select an organization first.</FormHint>;
  }

  if (certificate.isLoading) {
    return <p className="text-sm text-[var(--tc-muted)]">Loading certificate…</p>;
  }

  if (certificate.isError) {
    return <FormError>{getCertificateErrorMessage(certificate.error)}</FormError>;
  }

  const data = certificate.data;
  const result = verify.data?.verification;

  return (
    <>
      {data ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge tone={certificateStatusTone(data.status)}>{data.status}</Badge>
          <span className="text-sm text-[var(--tc-muted)]">{data.title}</span>
          <span className="text-sm text-[var(--tc-muted)]">· {data.recipient.name}</span>
        </div>
      ) : null}

      <Card className="mb-4 max-w-2xl">
        <CardHeader>
          <CardTitle>Verification panel</CardTitle>
          <CardDescription>
            Checks metadata integrity, stored PDF hash, revocation, expiration, and live chain.
          </CardDescription>
        </CardHeader>
        <Button
          disabled={!data || verify.isPending}
          onClick={() =>
            verify.mutate(certificateId, {
              onSuccess: (payload) =>
                feedback.success(
                  payload.verification.valid ? "Certificate is valid" : "Certificate is invalid",
                ),
              onError: (err) => feedback.error(err, "Verification failed"),
            })
          }
        >
          {verify.isPending ? "Verifying…" : "Run verification"}
        </Button>
        <FormError>{verify.error ? getCertificateErrorMessage(verify.error) : null}</FormError>
      </Card>

      {result ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Result</CardTitle>
            <CardDescription>
              <Badge tone={result.valid ? "success" : "danger"}>
                {result.valid ? "valid" : "invalid"}
              </Badge>{" "}
              <span className="ml-2 text-[var(--tc-muted)]">status: {result.status}</span>
            </CardDescription>
          </CardHeader>
          <ul className="mb-3 space-y-1 text-sm">
            <li>Integrity: {result.checks.integrity ? "pass" : "fail"}</li>
            <li>Not revoked: {result.checks.notRevoked ? "pass" : "fail"}</li>
            <li>Not expired: {result.checks.notExpired ? "pass" : "fail"}</li>
            <li>Document OK: {result.checks.documentOk ? "pass" : "fail"}</li>
            <li>PDF artifact: {result.checks.artifact ? "pass" : "fail"}</li>
            <li>Blockchain: {result.checks.chain ? "pass" : "fail"}</li>
            {verify.data?.chain?.txHash ? (
              <li className="font-mono text-xs text-[var(--tc-muted)]">
                Tx {verify.data.chain.txHash}
              </li>
            ) : null}
          </ul>
          {result.reasons.length ? (
            <div>
              <p className="mb-1 text-sm font-medium">Reasons</p>
              <ul className="list-inside list-disc text-sm text-[var(--tc-muted)]">
                {result.reasons.map((reason) => (
                  <li key={reason}>{verificationReasonLabel(reason)}</li>
                ))}
              </ul>
            </div>
          ) : (
            <FormHint>No failure reasons reported.</FormHint>
          )}
          {result.reasons.includes("ARTIFACT_MISSING") ? (
            <div className="mt-3">
              <FormHint>
                This does not mean the certificate is fake. The org record is issued, but the PDF file
                is missing from object storage (Backblaze B2). Run verification again to regenerate it,
                or confirm B2 credentials are configured for this environment.
              </FormHint>
            </div>
          ) : null}
          {data?.status === "revoked" ? (
            <FormError>This certificate is revoked. Verification cannot pass.</FormError>
          ) : null}
          {data?.status === "expired" ? (
            <FormError>This certificate is expired. Verification cannot pass.</FormError>
          ) : null}
        </Card>
      ) : (
        <FormHint>Run verification to see integrity and lifecycle checks.</FormHint>
      )}
    </>
  );
}
