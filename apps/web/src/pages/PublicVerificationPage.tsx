import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { useBillingEntitlements } from "../features/billing/hooks";
import { billingHref } from "../features/billing/PlanGate";
import { useSessionStore } from "../lib/sessionStore";
import { isCertificateHolderOnly } from "../lib/workspacePersona";
import { OutcomeBadge, VerificationMetadataViewer } from "../features/verification/VerificationResultPanels";
import { usePublicCertificateVerify } from "../features/certificates/publicVerifyHooks";
import { usePublicVerification } from "../features/verification/hooks";
import { getCertificateErrorMessage, verificationReasonLabel } from "../lib/certificateErrors";
import { getVerificationErrorMessage, resolvePublicVerifyTarget } from "../lib/verifyErrors";

/**
 * Public lookup: paste a certificate URL or QR destination. No hash / code dropdowns.
 */
export function PublicVerificationPage() {
  const location = useLocation();
  const embedded = location.pathname === "/verify";
  const publicVerify = usePublicVerification();
  const [value, setValue] = useState("");
  const [resolvedId, setResolvedId] = useState<string>("");
  const [localError, setLocalError] = useState<string | null>(null);
  const certLookup = usePublicCertificateVerify(resolvedId);
  const accessToken = useSessionStore((s) => s.accessToken);
  const roles = useSessionStore((s) => s.roles);
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const holder = Boolean(accessToken) && isCertificateHolderOnly(roles, organizationId);
  const billing = useBillingEntitlements(holder ? null : organizationId);
  const holderQuota = billing.data?.user.quotas.holder_verifications;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLocalError(null);
    setResolvedId("");
    publicVerify.reset();
    const target = resolvePublicVerifyTarget(value);
    if (!target) {
      setLocalError("Paste a certificate URL or the QR link. Example: …/certificates/verify/CERT-…");
      return;
    }
    if (target.kind === "certificate") {
      setResolvedId(target.publicId);
      return;
    }
    publicVerify.mutate({ kind: "qr", payload: value.trim() });
  }

  const report = publicVerify.data ?? null;
  const cert = certLookup.data?.certificate;
  const result = certLookup.data?.verification;

  const lookupForm = (
    <Card>
      <CardHeader>
        <CardTitle>Certificate URL or QR</CardTitle>
        <CardDescription>Paste the link from the PDF or scan the QR — that is the only public check.</CardDescription>
      </CardHeader>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="lookup-value">URL or QR payload</Label>
          <Input
            id="lookup-value"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://…/certificates/verify/CERT-…"
          />
          <FormHint>
            {holder && holderQuota
              ? `Holder plan: ${holderQuota.used} of ${holderQuota.limit ?? "unlimited"} verifications used this month.`
              : "Hashes, verification codes, and CSV lists are organization staff tools — not this page."}
            {holder ? (
              <>
                {" "}
                <Link to={billingHref()} className="text-[var(--tc-accent)] hover:underline">
                  Upgrade
                </Link>
              </>
            ) : null}
          </FormHint>
        </Field>
        <FormError>
          {localError ??
            (publicVerify.error ? getVerificationErrorMessage(publicVerify.error) : null) ??
            (certLookup.isError ? getCertificateErrorMessage(certLookup.error) : null)}
        </FormError>
        <Button type="submit" disabled={publicVerify.isPending || certLookup.isFetching}>
          {publicVerify.isPending || certLookup.isFetching ? "Checking…" : "Verify"}
        </Button>
      </form>
    </Card>
  );

  const certPanel =
    cert && result ? (
      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{cert.title}</CardTitle>
            <CardDescription>
              Issued to {cert.recipientName}
              {cert.organizationName ? ` · ${cert.organizationName}` : ""}
            </CardDescription>
          </CardHeader>
          <div className="flex flex-wrap items-center gap-2 px-5 pb-5">
            <Badge tone={result.valid ? "success" : "danger"}>
              {result.valid ? "Verified" : "Not verified"}
            </Badge>
            <Badge tone="neutral">{cert.publicId}</Badge>
          </div>
        </Card>
        {result.reasons?.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--tc-muted)]">
            {result.reasons.map((reason) => (
              <li key={reason}>{verificationReasonLabel(reason)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    ) : null;

  const resultPanel = report ? (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <OutcomeBadge outcome={report.verificationResult} />
        <span className="text-sm text-[var(--tc-muted)]">
          {new Date(report.verificationTimestamp).toLocaleString()}
        </span>
      </div>
      <VerificationMetadataViewer publicReport={report} />
    </div>
  ) : null;

  const body = (
    <div className="space-y-6">
      {lookupForm}
      {certPanel}
      {resultPanel}
    </div>
  );

  if (embedded) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader
          title="Verify a certificate"
          description="Paste the certificate URL or QR link from a TrustChain PDF."
        />
        {body}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-10">
      <Link to="/" className="mb-8 font-display text-2xl font-semibold tracking-tight text-[var(--tc-fg)]">
        TrustChain
      </Link>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-[var(--tc-fg)]">
            Public verification
          </h1>
          <p className="mt-1 text-sm text-[var(--tc-muted)]">
            Paste the certificate URL or the QR destination. Nothing else is needed.
          </p>
          <Link to="/login" className="mt-2 inline-block text-sm text-[var(--tc-accent)] hover:underline">
            Sign in
          </Link>
        </div>
        {body}
      </div>
    </div>
  );
}
