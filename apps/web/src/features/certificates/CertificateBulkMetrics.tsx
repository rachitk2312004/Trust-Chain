import { Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { CertificateAnalyticsSnapshot } from "../../types/api";

export function CertificateBulkMetrics({
  bulk,
}: {
  bulk: CertificateAnalyticsSnapshot["bulk"] | undefined;
}) {
  if (!bulk) return <FormHint>No bulk job metrics.</FormHint>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk jobs</CardTitle>
        <CardDescription>
          {bulk.totalJobs} jobs · success rate{" "}
          {bulk.successRate != null ? `${bulk.successRate}%` : "—"}
        </CardDescription>
      </CardHeader>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-[var(--tc-muted)]">Rows</dt>
          <dd className="font-medium">{bulk.totalRows}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Success</dt>
          <dd className="font-medium">{bulk.successRows}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Failed</dt>
          <dd className="font-medium">{bulk.failedRows}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Rolled back</dt>
          <dd className="font-medium">{bulk.rolledBackCount}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-[var(--tc-muted)]">
        {Object.entries(bulk.byStatus).map(([status, count]) => (
          <span key={status}>
            {status}: {count}
          </span>
        ))}
      </div>
    </Card>
  );
}
