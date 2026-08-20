import { Link, useParams } from "react-router-dom";
import { Badge, Card, CardDescription, CardHeader, CardTitle, FormError } from "@trustchain/ui";
import { usePublicCertificateVerify } from "../features/certificates/publicVerifyHooks";
import {
  certificateStatusTone,
  getCertificateErrorMessage,
  verificationReasonLabel,
} from "../lib/certificateErrors";

/**
 * Anonymous certificate verification by public ID (from QR or share link).
 */
export function PublicCertificateVerifyPage() {
  const { publicId = "" } = useParams();
  const verify = usePublicCertificateVerify(publicId);

  const cert = verify.data?.certificate;
  const result = verify.data?.verification;

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <Link
        to="/"
        className="mb-8 font-display text-2xl font-semibold tracking-tight text-[var(--tc-fg)]"
      >
        TrustChain
      </Link>

      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--tc-fg)]">
            Certificate verification
          </h1>
          <p className="mt-1 text-sm text-[var(--tc-muted)]">
            Confirm this credential was issued by the organization and has not been tampered with.
          </p>
          {publicId ? (
            <p className="mt-2 font-mono text-xs text-[var(--tc-muted)]">{publicId}</p>
          ) : null}
        </div>

        {verify.isLoading ? (
          <p className="text-sm text-[var(--tc-muted)]">Verifying certificate…</p>
        ) : null}

        {verify.isError ? (
          <FormError>{getCertificateErrorMessage(verify.error)}</FormError>
        ) : null}

        {cert && result ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>{cert.title}</CardTitle>
                <CardDescription>
                  Issued to {cert.recipientName}
                  {cert.organizationName ? ` · ${cert.organizationName}` : ""}
                </CardDescription>
              </CardHeader>
              <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
                <Badge tone={certificateStatusTone(cert.status)}>{cert.status}</Badge>
                <Badge tone={result.valid ? "success" : "danger"}>
                  {result.valid ? "Verified" : "Not verified"}
                </Badge>
              </div>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Checks</CardTitle>
                <CardDescription>Integrity and lifecycle validation</CardDescription>
              </CardHeader>
              <ul className="space-y-1 px-5 pb-5 text-sm">
                <li>Integrity: {result.checks.integrity ? "pass" : "fail"}</li>
                <li>Not revoked: {result.checks.notRevoked ? "pass" : "fail"}</li>
                <li>Not expired: {result.checks.notExpired ? "pass" : "fail"}</li>
                <li>Document OK: {result.checks.documentOk ? "pass" : "fail"}</li>
              </ul>
              {result.reasons.length ? (
                <ul className="list-inside list-disc px-5 pb-5 text-sm text-[var(--tc-muted)]">
                  {result.reasons.map((reason) => (
                    <li key={reason}>{verificationReasonLabel(reason)}</li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-sm text-[var(--tc-muted)]">All checks passed.</p>
              )}
            </Card>

            {cert.issuedAt ? (
              <p className="text-sm text-[var(--tc-muted)]">
                Issued {new Date(cert.issuedAt).toLocaleString()}
                {cert.expiresAt ? ` · Expires ${new Date(cert.expiresAt).toLocaleString()}` : ""}
              </p>
            ) : null}

            {cert.status === "revoked" && cert.revokeReason ? (
              <FormError>Revocation reason: {cert.revokeReason}</FormError>
            ) : null}
          </>
        ) : null}

        <p className="text-center text-sm text-[var(--tc-muted)]">
          <Link to="/verification/public" className="text-[var(--tc-accent)] hover:underline">
            Verify documents
          </Link>
          {" · "}
          <Link to="/login" className="text-[var(--tc-accent)] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
