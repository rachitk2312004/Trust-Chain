import { useCallback, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
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
import { VerificationReportTable } from "../features/verification/VerificationReportTable";
import { useIntakeVerify, useVerifyFile } from "../features/verification/hooks";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { parseFileNameClaims } from "../lib/verificationCsv";
import { validateLocalFile } from "../lib/docErrors";
import { rowsFromIntake } from "../lib/verificationReport";
import { getVerificationErrorMessage } from "../lib/verifyErrors";
import { useSessionStore } from "../lib/sessionStore";
import type { PublicVerificationReport, VerificationReport } from "../types/api";

export function VerificationUploadPage() {
  const navigate = useNavigate();
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const verifyFile = useVerifyFile(organizationId);
  const intake = useIntakeVerify(organizationId ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [applicantName, setApplicantName] = useState("");
  const [nameMap, setNameMap] = useState<Record<string, string>>({});
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const staffIntake = Boolean(organizationId);

  const setPickedFiles = useCallback((next: File[]) => {
    setLocalError(null);
    const accepted: File[] = [];
    for (const file of next.slice(0, 50)) {
      const err = validateLocalFile(file);
      if (err) {
        setLocalError(`${file.name}: ${err}`);
        continue;
      }
      accepted.push(file);
    }
    setFiles(accepted);
  }, []);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragOver(false);
    setPickedFiles(Array.from(event.dataTransfer.files ?? []));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!files.length) {
      setLocalError("Choose at least one file to verify.");
      return;
    }
    if (staffIntake) {
      intake.mutate({
        files,
        claimedNames: nameMap,
        applicantName: applicantName.trim() || undefined,
      });
      return;
    }
    const file = files[0];
    if (!file) {
      setLocalError("Choose at least one file to verify.");
      return;
    }
    verifyFile.mutate({
      file,
    });
  }

  const orgReport: VerificationReport | null =
    verifyFile.data?.kind === "organization" ? verifyFile.data.data.report : null;
  const publicReport: PublicVerificationReport | null =
    verifyFile.data?.kind === "public" ? verifyFile.data.data : null;
  const intakeResults = intake.data?.results ?? (verifyFile.data?.kind === "intake" ? verifyFile.data.data.results : null);
  const pending = intake.isPending || verifyFile.isPending;

  return (
    <AppShellLayout>
      <PageHeader
        title="Check PDF files"
        description="Drop the PDFs you received. We read the name and certificate ID from each file and build a shareable table."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/verification/bulk" className="text-[var(--tc-accent)] hover:underline">
              CERT ID CSV
            </Link>
            <Link to="/verification/history" className="text-[var(--tc-accent)] hover:underline">
              History
            </Link>
          </div>
        }
      />

      <form className="flex max-w-3xl flex-col gap-4" onSubmit={onSubmit}>
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
          <p className="font-medium">
            {files.length
              ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
              : "Drop PDFs here"}
          </p>
          <p className="text-[var(--tc-muted)]">One file or many · PDF, images, DOC/DOCX · max 25 MiB each · up to 50 files</p>
          {files.length ? (
            <ul className="mt-2 max-h-32 w-full overflow-auto text-left text-xs text-[var(--tc-muted)]">
              {files.map((file) => (
                <li key={`${file.name}-${file.size}`}>{file.name}</li>
              ))}
            </ul>
          ) : null}
          <input
            ref={inputRef}
            type="file"
            multiple={staffIntake}
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,application/pdf,image/png,image/jpeg,image/webp"
            onChange={(e) => setPickedFiles(Array.from(e.target.files ?? []))}
          />
        </div>

        <Field>
          <Label htmlFor="applicant-name">{files.length > 1 ? "Applicant names CSV (optional)" : "Applicant name (optional)"}</Label>
          {files.length > 1 ? (
            <>
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                className="text-sm"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  setNameMap(parseFileNameClaims(await file.text()));
                }}
              />
              <FormHint>CSV columns: file, name — used when someone submits another person’s real PDF.</FormHint>
            </>
          ) : (
            <>
              <Input
                id="applicant-name"
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="Name the applicant used"
              />
              <FormHint>
                If this is another person’s real certificate, we show this name next to the real holder.
              </FormHint>
            </>
          )}
        </Field>

        <FormError>
          {localError ??
            (intake.error ? intake.error.message || getVerificationErrorMessage(intake.error) : null) ??
            (verifyFile.error ? getVerificationErrorMessage(verifyFile.error) : null)}
        </FormError>

        <Button type="submit" disabled={pending} className="self-start">
          {pending ? "Checking…" : staffIntake ? "Check PDFs" : "Check file"}
        </Button>
      </form>

      {intake.data ? (
        <div className="mt-8 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Real {intake.data.summary.valid}</Badge>
            <Badge tone="danger">Not real {intake.data.summary.failed}</Badge>
          </div>
          <VerificationReportTable
            title="File results"
            rows={rowsFromIntake(intakeResults ?? intake.data.results)}
          />
        </div>
      ) : null}

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
