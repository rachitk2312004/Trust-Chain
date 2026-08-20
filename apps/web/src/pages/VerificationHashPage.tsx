import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
  Select,
} from "@trustchain/ui";
import { DocumentPicker } from "../components/DocumentPicker";
import { PageHeader } from "../components/PageHeader";
import {
  ConfidenceIndicator,
  OutcomeBadge,
  VerificationMetadataViewer,
  VerificationTimeline,
} from "../features/verification/VerificationResultPanels";
import { useVerifyHash, useVerifyIdentifier } from "../features/verification/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { AppShellLayout } from "../layouts/AppShellLayout";
import {
  getVerificationErrorMessage,
  isSha256Hex,
} from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { PublicVerificationReport, VerificationReport } from "../types/api";

export function VerificationHashPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const feedback = useFeedback();
  const verifyHash = useVerifyHash(organizationId);
  const verifyIdentifier = useVerifyIdentifier();
  const [hash, setHash] = useState("");
  const [documentId, setDocumentId] = useState("");
  const [mode, setMode] = useState<"public" | "organization">("public");
  const [identifierType, setIdentifierType] = useState<
    "verificationCode" | "publicVerifyCode" | "transactionHash"
  >("verificationCode");
  const [identifier, setIdentifier] = useState("");

  function onHashSubmit(event: FormEvent) {
    event.preventDefault();
    verifyHash.mutate(
      {
        contentHash: hash,
        documentId: documentId.trim() || undefined,
        mode,
      },
      {
        onSuccess: () => feedback.success("Verification complete"),
        onError: (err) => feedback.error(err, "Verification failed"),
      },
    );
  }

  function onIdentifierSubmit(event: FormEvent) {
    event.preventDefault();
    verifyIdentifier.mutate(
      { type: identifierType, value: identifier },
      {
        onSuccess: () => feedback.success("Lookup complete"),
        onError: (err) => feedback.error(err, "Lookup failed"),
      },
    );
  }

  const orgReport: VerificationReport | null =
    verifyHash.data?.kind === "organization" ? verifyHash.data.data.report : null;
  const publicFromHash: PublicVerificationReport | null =
    verifyHash.data?.kind === "public" ? verifyHash.data.data : null;
  const publicFromId = verifyIdentifier.data ?? null;

  return (
    <AppShellLayout>
      <PageHeader
        title="Hash & identifier verification"
        description="SHA-256 hash lookup and identifier verification via public or organization APIs."
        actions={
          <Link to="/verification" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <form className="flex flex-col gap-3" onSubmit={onHashSubmit}>
          <Field>
            <Label htmlFor="content-hash">SHA-256 content hash</Label>
            <Input
              id="content-hash"
              required
              value={hash}
              onChange={(e) => setHash(e.target.value)}
              placeholder="64-character hex digest"
            />
            <FormHint>
              {hash && !isSha256Hex(hash) ? "Hash must be exactly 64 hex characters." : null}
            </FormHint>
          </Field>
          <Field>
            <Label htmlFor="verify-mode">Mode</Label>
            <Select
              id="verify-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as "public" | "organization")}
            >
              <option value="public">Public hash lookup</option>
              <option value="organization">Organization document verify</option>
            </Select>
          </Field>
          {mode === "organization" ? (
            organizationId ? (
              <DocumentPicker
                organizationId={organizationId}
                value={documentId}
                onChange={setDocumentId}
                required
                label="Document"
              />
            ) : (
              <FormHint>Select an active organization first.</FormHint>
            )
          ) : null}
          <FormError>
            {verifyHash.error ? getVerificationErrorMessage(verifyHash.error) : null}
          </FormError>
          <Button type="submit" disabled={verifyHash.isPending} className="self-start">
            {verifyHash.isPending ? "Verifying…" : "Verify hash"}
          </Button>
        </form>

        <form className="flex flex-col gap-3" onSubmit={onIdentifierSubmit}>
          <Field>
            <Label htmlFor="id-type">Identifier type</Label>
            <Select
              id="id-type"
              value={identifierType}
              onChange={(e) =>
                setIdentifierType(
                  e.target.value as "verificationCode" | "publicVerifyCode" | "transactionHash",
                )
              }
            >
              <option value="verificationCode">Verification code</option>
              <option value="publicVerifyCode">Public document code</option>
              <option value="transactionHash">Transaction hash</option>
            </Select>
          </Field>
          <Field>
            <Label htmlFor="identifier">Identifier</Label>
            <Input
              id="identifier"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Field>
          <FormError>
            {verifyIdentifier.error
              ? getVerificationErrorMessage(verifyIdentifier.error)
              : null}
          </FormError>
          <Button type="submit" disabled={verifyIdentifier.isPending} className="self-start">
            {verifyIdentifier.isPending ? "Looking up…" : "Verify identifier"}
          </Button>
        </form>
      </div>

      {orgReport || publicFromHash || publicFromId ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <OutcomeBadge
                outcome={
                  orgReport?.verificationResult ??
                  publicFromHash?.verificationResult ??
                  publicFromId?.verificationResult
                }
              />
              {orgReport ? <ConfidenceIndicator report={orgReport} /> : null}
              {verifyHash.data?.kind === "organization" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const result = verifyHash.data;
                    if (result?.kind === "organization") {
                      navigate(`/verification/${result.data.request.id}`);
                    }
                  }}
                >
                  Open details
                </Button>
              ) : null}
            </div>
            <VerificationTimeline report={orgReport} status={orgReport?.status} />
          </div>
          <VerificationMetadataViewer
            report={orgReport}
            publicReport={publicFromHash ?? publicFromId}
          />
        </div>
      ) : null}
    </AppShellLayout>
  );
}
