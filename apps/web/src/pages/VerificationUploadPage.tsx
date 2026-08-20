import { useCallback, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  Field,
  FormError,
  FormHint,
  Input,
  Label,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  ConfidenceIndicator,
  OutcomeBadge,
  VerificationMetadataViewer,
  VerificationTimeline,
} from "../features/verification/VerificationResultPanels";
import { useVerifyFile } from "../features/verification/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { validateLocalFile } from "../lib/docErrors";
import { getVerificationErrorMessage } from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { PublicVerificationReport, VerificationReport } from "../types/api";

export function VerificationUploadPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const verifyFile = useVerifyFile(organizationId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [rehashFromR2, setRehashFromR2] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const setPickedFile = useCallback((next: File | null) => {
    setLocalError(null);
    if (!next) {
      setFile(null);
      return;
    }
    const err = validateLocalFile(next);
    if (err) {
      setLocalError(err);
      setFile(null);
      return;
    }
    setFile(next);
  }, []);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    setPickedFile(event.dataTransfer.files?.[0] ?? null);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!file) {
      setLocalError("Choose a file to verify.");
      return;
    }
    verifyFile.mutate({
      file,
      documentId: documentId.trim() || undefined,
      rehashFromR2,
    });
  }

  const orgReport: VerificationReport | null =
    verifyFile.data?.kind === "organization" ? verifyFile.data.data.report : null;
  const publicReport: PublicVerificationReport | null =
    verifyFile.data?.kind === "public" ? verifyFile.data.data : null;

  return (
    <AppShellLayout>
      <PageHeader
        title="File verification"
        description="Hash a local file and verify against public hash lookup or an organization document."
        actions={
          <Link to="/verification" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      <form className="flex max-w-xl flex-col gap-4" onSubmit={onSubmit}>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center text-sm",
            dragOver
              ? "border-[var(--tc-accent)] bg-[var(--tc-surface-2)]"
              : "border-[var(--tc-border)] bg-[var(--tc-surface)]",
          ].join(" ")}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
        >
          <p className="font-medium">{file ? file.name : "Drag and drop a file to verify"}</p>
          <p className="text-[var(--tc-muted)]">PDF, images, DOC/DOCX · max 25 MiB</p>
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <Field>
          <Label htmlFor="verify-doc-id">Document ID (optional, organization mode)</Label>
          <Input
            id="verify-doc-id"
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            placeholder="Leave empty for public hash lookup"
          />
          <FormHint>
            With a document ID and active organization, runs POST …/documents/:id/verify with the
            file hash{organizationId ? "" : " (select an organization first)"}.
          </FormHint>
        </Field>

        {documentId.trim() ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rehashFromR2}
              onChange={(e) => setRehashFromR2(e.target.checked)}
            />
            Re-hash object from storage (requires download permission)
          </label>
        ) : null}

        <FormError>
          {localError ??
            (verifyFile.error ? getVerificationErrorMessage(verifyFile.error) : null)}
        </FormError>

        {verifyFile.data?.contentHash ? (
          <FormHint>
            Computed SHA-256:{" "}
            <span className="font-mono text-xs">{verifyFile.data.contentHash}</span>
          </FormHint>
        ) : null}

        <Button type="submit" disabled={verifyFile.isPending} className="self-start">
          {verifyFile.isPending ? "Verifying…" : "Verify file"}
        </Button>
      </form>

      {orgReport || publicReport ? (
        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <OutcomeBadge
                outcome={orgReport?.verificationResult ?? publicReport?.verificationResult}
              />
              {orgReport ? <ConfidenceIndicator report={orgReport} /> : null}
              {verifyFile.data?.kind === "organization" ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const result = verifyFile.data;
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
          <VerificationMetadataViewer report={orgReport} publicReport={publicReport} />
        </div>
      ) : null}
    </AppShellLayout>
  );
}
