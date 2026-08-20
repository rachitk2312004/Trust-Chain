import { Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminAuditAnalytics } from "../../types/api";

export function AdminAuditMetrics({ data }: { data: AdminAuditAnalytics | undefined }) {
  if (!data) return <FormHint>No audit metrics.</FormHint>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit metrics</CardTitle>
        <CardDescription>
          {data.total} events · success {data.successRate ?? "—"}%
        </CardDescription>
      </CardHeader>
      <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--tc-muted)]">Success</dt>
          <dd>{data.successCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Failure</dt>
          <dd>{data.failureCount}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Config changes</dt>
          <dd>{data.configurationChanges}</dd>
        </div>
      </dl>
      <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--tc-muted)]">
        Top actions
      </h3>
      <ul className="space-y-1 text-sm">
        {data.topActions.slice(0, 8).map((row) => (
          <li key={row.action} className="flex justify-between gap-2">
            <span className="font-mono text-xs">{row.action}</span>
            <span className="text-[var(--tc-muted)]">{row.count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
