import { Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { SignatureAnalyticsSnapshot } from "../../types/api";

export function SignatureWorkflowMetrics({
  workflows,
  processAverageApprovalMs,
}: {
  workflows: SignatureAnalyticsSnapshot["workflows"] | undefined;
  processAverageApprovalMs?: number | null;
}) {
  if (!workflows) return null;

  const statusEntries = Object.entries(workflows.byStatus);
  const typeEntries = Object.entries(workflows.byType);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Approval workflows</CardTitle>
        <CardDescription>
          {workflows.total} total · {workflows.pending} pending · completion{" "}
          {workflows.completionRate != null ? `${workflows.completionRate}%` : "—"} · rejection{" "}
          {workflows.rejectionRate != null ? `${workflows.rejectionRate}%` : "—"}
        </CardDescription>
      </CardHeader>
      <p className="mb-2 text-sm text-[var(--tc-muted)]">
        Avg approval latency:{" "}
        {workflows.averageApprovalLatencyMs != null
          ? `${workflows.averageApprovalLatencyMs}ms`
          : processAverageApprovalMs != null
            ? `${processAverageApprovalMs}ms`
            : "—"}
      </p>
      {statusEntries.length === 0 && typeEntries.length === 0 ? (
        <FormHint>No workflows yet.</FormHint>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-[var(--tc-muted)]">By status</p>
            <ul className="space-y-1 text-sm">
              {statusEntries.map(([status, count]) => (
                <li key={status} className="flex justify-between gap-2">
                  <span>{status}</span>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-[var(--tc-muted)]">By type</p>
            <ul className="space-y-1 text-sm">
              {typeEntries.map(([type, count]) => (
                <li key={type} className="flex justify-between gap-2">
                  <span>{type}</span>
                  <span className="font-mono">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}
