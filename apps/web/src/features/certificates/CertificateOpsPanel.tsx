import { Button, Card, CardDescription, CardHeader, CardTitle, FormError, FormHint } from "@trustchain/ui";
import { getCertificateErrorMessage } from "../../lib/certificateErrors";
import { useFeedback } from "../../hooks/useFeedback";
import {
  useAdminCleanupCertificates,
  useAdminReprocessCertificates,
} from "./hooks";

export function CertificateOpsPanel({ organizationId }: { organizationId: string }) {
  const feedback = useFeedback();
  const reprocess = useAdminReprocessCertificates(organizationId);
  const cleanup = useAdminCleanupCertificates(organizationId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administration</CardTitle>
        <CardDescription>Reprocess certificates and run retention cleanup</CardDescription>
      </CardHeader>
      <FormHint>
        Reprocess re-verifies and re-renders up to 20 certificates. Cleanup removes old events,
        terminal bulk jobs, and short-lived download/render diagnostics.
      </FormHint>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={reprocess.isPending}
          onClick={() =>
            reprocess.mutate(
              { limit: 20, renderFormat: "png" },
              {
                onSuccess: (data) =>
                  feedback.success(
                    `Reprocessed ${data.succeeded}/${data.processed} certificates`,
                  ),
                onError: (err) => feedback.error(err, "Reprocess failed"),
              },
            )
          }
        >
          {reprocess.isPending ? "Reprocessing…" : "Reprocess"}
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={cleanup.isPending}
          onClick={() =>
            cleanup.mutate(undefined, {
              onSuccess: (data) =>
                feedback.success(
                  `Cleanup removed ${data.result.deletedEvents} events, ${data.result.deletedBulkJobs} bulk jobs`,
                ),
              onError: (err) => feedback.error(err, "Cleanup failed"),
            })
          }
        >
          {cleanup.isPending ? "Cleaning…" : "Run cleanup"}
        </Button>
      </div>
      <FormError>
        {reprocess.error
          ? getCertificateErrorMessage(reprocess.error)
          : cleanup.error
            ? getCertificateErrorMessage(cleanup.error)
            : null}
      </FormError>
      {cleanup.data ? (
        <pre className="mt-3 overflow-auto rounded bg-[var(--tc-surface-2)] p-2 text-xs">
          {JSON.stringify(cleanup.data.result, null, 2)}
        </pre>
      ) : null}
      {reprocess.data ? (
        <pre className="mt-3 max-h-48 overflow-auto rounded bg-[var(--tc-surface-2)] p-2 text-xs">
          {JSON.stringify(
            {
              succeeded: reprocess.data.succeeded,
              failed: reprocess.data.failed,
              results: reprocess.data.results.slice(0, 10),
            },
            null,
            2,
          )}
        </pre>
      ) : null}
    </Card>
  );
}
