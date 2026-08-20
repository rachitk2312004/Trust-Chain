import { Badge, Button, FormError, FormHint } from "@trustchain/ui";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import type { CertificateBulkJob } from "../../types/api";
import { useCancelCertificateBulk } from "./hooks";

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case "completed":
      return "success";
    case "processing":
    case "pending":
      return "info";
    case "cancelled":
      return "warning";
    case "failed":
      return "danger";
    default:
      return "neutral";
  }
}

export function BulkProgressPanel({
  organizationId,
  job,
  onCancelled,
}: {
  organizationId: string;
  job: CertificateBulkJob | null | undefined;
  onCancelled?: () => void;
}) {
  const cancel = useCancelCertificateBulk(organizationId);

  if (!job) {
    return <FormHint>No bulk job running.</FormHint>;
  }

  const terminal =
    job.status === "completed" || job.status === "failed" || job.status === "cancelled";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={statusTone(job.status)}>{job.status}</Badge>
        <span className="text-sm text-[var(--tc-muted)]">
          {job.processedRows}/{job.totalRows} processed ({job.percentComplete}%)
        </span>
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded bg-[var(--tc-surface-2)]"
        role="progressbar"
        aria-valuenow={job.percentComplete}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-[var(--tc-accent)] transition-all"
          style={{ width: `${job.percentComplete}%` }}
        />
      </div>

      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <div>
          <p className="text-[var(--tc-muted)]">Success</p>
          <p className="font-medium">{job.successRows}</p>
        </div>
        <div>
          <p className="text-[var(--tc-muted)]">Failed</p>
          <p className="font-medium">{job.failedRows}</p>
        </div>
        <div>
          <p className="text-[var(--tc-muted)]">Skipped</p>
          <p className="font-medium">{job.skippedRows}</p>
        </div>
        <div>
          <p className="text-[var(--tc-muted)]">Rolled back</p>
          <p className="font-medium">{job.rolledBackCount}</p>
        </div>
      </div>

      {!terminal ? (
        <div className="flex flex-col gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={cancel.isPending || job.cancelRequested}
            onClick={() =>
              cancel.mutate(job.jobId, {
                onSuccess: () => onCancelled?.(),
              })
            }
          >
            {job.cancelRequested || cancel.isPending ? "Cancelling…" : "Cancel job"}
          </Button>
          {job.rollbackOnCancel ? (
            <FormHint>Cancellation revokes certificates already issued in this job.</FormHint>
          ) : null}
        </div>
      ) : null}

      <FormError>{cancel.error ? getCertificateErrorMessage(cancel.error) : null}</FormError>

      {job.errors.length ? (
        <div className="rounded border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-3">
          <p className="mb-2 text-sm font-medium">Failure report</p>
          <ul className="max-h-48 space-y-1 overflow-auto text-xs text-[var(--tc-muted)]">
            {job.errors.slice(0, 50).map((err) => (
              <li key={`${err.rowNumber}-${err.code}-${err.message}`}>
                Row {err.rowNumber}: [{err.code}] {err.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
