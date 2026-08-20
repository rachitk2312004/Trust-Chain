import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";

type QuotaSample = {
  organizationId: string;
  slug: string;
  overLimit: boolean;
  utilization: Array<{
    resource: string;
    used: number;
    limit: number;
    percent: number | null;
  }>;
};

export function QuotaInspector({
  samples,
  tenantsWithQuota,
  overLimit,
}: {
  samples: QuotaSample[];
  tenantsWithQuota?: number;
  overLimit?: number;
}) {
  if (!samples.length) {
    return <FormHint>No quota samples in the current inspection window.</FormHint>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quota inspection</CardTitle>
        <CardDescription>
          {tenantsWithQuota ?? samples.length} tenants with quotas
          {overLimit != null ? ` · ${overLimit} over limit` : ""}
        </CardDescription>
      </CardHeader>
      <ul className="space-y-3 text-sm">
        {samples.map((sample) => (
          <li key={sample.organizationId} className="rounded border border-[var(--tc-border)] p-2">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="font-mono text-xs">{sample.slug}</span>
              <Badge tone={sample.overLimit ? "warning" : "success"}>
                {sample.overLimit ? "over" : "ok"}
              </Badge>
            </div>
            <ul className="space-y-1 text-xs text-[var(--tc-muted)]">
              {sample.utilization.map((row) => (
                <li key={row.resource} className="flex justify-between gap-2">
                  <span>{row.resource}</span>
                  <span>
                    {row.used}/{row.limit === 0 ? "∞" : row.limit}
                    {row.percent != null ? ` (${row.percent}%)` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Card>
  );
}
