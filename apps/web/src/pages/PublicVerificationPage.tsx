import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import {
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
  Select,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  OutcomeBadge,
  VerificationMetadataViewer,
} from "../features/verification/VerificationResultPanels";
import { usePublicVerification } from "../features/verification/hooks";
import { getVerificationErrorMessage } from "../lib/verifyErrors";

type LookupKind = "hash" | "code" | "document" | "tx" | "link" | "qr";

/**
 * Anonymous-friendly public verification page (no org session required).
 * Uses /api/public endpoints only.
 */
export function PublicVerificationPage() {
  const location = useLocation();
  const embedded = location.pathname === "/verify";
  const publicVerify = usePublicVerification();
  const [kind, setKind] = useState<LookupKind>("code");
  const [value, setValue] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = value.trim();
    switch (kind) {
      case "hash":
        publicVerify.mutate({ kind: "hash", hash: trimmed });
        break;
      case "code":
        publicVerify.mutate({ kind: "code", code: trimmed });
        break;
      case "document":
        publicVerify.mutate({ kind: "document", publicVerifyCode: trimmed });
        break;
      case "tx":
        publicVerify.mutate({ kind: "tx", transactionHash: trimmed });
        break;
      case "link":
        publicVerify.mutate({ kind: "link", tokenOrUrl: trimmed });
        break;
      case "qr":
        publicVerify.mutate({ kind: "qr", payload: trimmed });
        break;
    }
  }

  const report = publicVerify.data ?? null;

  const lookupForm = (
    <Card>
      <CardHeader>
        <CardTitle>Lookup</CardTitle>
        <CardDescription>Calls anonymous /api/public verification routes.</CardDescription>
      </CardHeader>
      <form className="flex flex-col gap-3" onSubmit={onSubmit}>
        <Field>
          <Label htmlFor="lookup-kind">Lookup type</Label>
          <Select
            id="lookup-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as LookupKind)}
          >
            <option value="code">Verification code</option>
            <option value="hash">Content hash</option>
            <option value="document">Public document code</option>
            <option value="tx">Transaction hash</option>
            <option value="link">Public link token / URL</option>
            <option value="qr">QR-linked payload / URL</option>
          </Select>
        </Field>
        <Field>
          <Label htmlFor="lookup-value">Value</Label>
          <Input
            id="lookup-value"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={
              kind === "qr" || kind === "link" ? "Paste link URL or token" : "Paste identifier"
            }
          />
          {kind === "qr" ? (
            <FormHint>
              Paste the QR destination URL or opaque link token. QR asset management is not part of
              this step.
            </FormHint>
          ) : null}
        </Field>
        <FormError>
          {publicVerify.error ? getVerificationErrorMessage(publicVerify.error) : null}
        </FormError>
        <Button type="submit" disabled={publicVerify.isPending}>
          {publicVerify.isPending ? "Verifying…" : "Verify"}
        </Button>
      </form>
    </Card>
  );

  const resultPanel = report ? (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <OutcomeBadge outcome={report.verificationResult} />
        <span className="text-sm text-[var(--tc-muted)]">
          {new Date(report.verificationTimestamp).toLocaleString()}
        </span>
      </div>
      <VerificationMetadataViewer publicReport={report} />
      {report.urls ? (
        <Card>
          <CardHeader>
            <CardTitle>Public URLs</CardTitle>
          </CardHeader>
          <ul className="space-y-1 px-1 text-sm">
            {Object.entries(report.urls).map(([key, url]) => (
              <li key={key}>
                <span className="text-[var(--tc-muted)]">{key}: </span>
                {url ? (
                  <a
                    href={url}
                    className="break-all text-[var(--tc-accent)] hover:underline"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {url}
                  </a>
                ) : (
                  "—"
                )}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  ) : null;

  if (embedded) {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <PageHeader
          title="Verify document"
          description="Look up a TrustChain document by hash, code, transaction, or QR/link token."
        />
        {lookupForm}
        {resultPanel}
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
            Look up a TrustChain document by hash, code, transaction, or QR/link token.
          </p>
          <Link to="/login" className="mt-2 inline-block text-sm text-[var(--tc-accent)] hover:underline">
            Sign in
          </Link>
        </div>

        {lookupForm}

        {resultPanel}
      </div>
    </div>
  );
}
