import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminPolicyAnalytics } from "../../types/api";

export function AdminPolicyMetrics({ data }: { data: AdminPolicyAnalytics | undefined }) {
  if (!data) return <FormHint>No policy metrics.</FormHint>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Policy metrics</CardTitle>
        <CardDescription>
          {data.definitions} definitions · {data.evaluations.total} evaluations
        </CardDescription>
      </CardHeader>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(data.byType).map(([type, count]) => (
          <Badge key={type}>
            {type}: {count}
          </Badge>
        ))}
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--tc-muted)]">Allow rate</dt>
          <dd>{data.evaluations.allowRate ?? "—"}%</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Deny rate</dt>
          <dd>{data.evaluations.denyRate ?? "—"}%</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Conflict rate</dt>
          <dd>{data.evaluations.conflictRate ?? "—"}%</dd>
        </div>
      </dl>
      <ul className="mt-3 space-y-1 text-sm">
        {Object.entries(data.evaluations.byDecision).map(([decision, count]) => (
          <li key={decision} className="flex justify-between gap-2">
            <span>{decision}</span>
            <span className="text-[var(--tc-muted)]">{count}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
