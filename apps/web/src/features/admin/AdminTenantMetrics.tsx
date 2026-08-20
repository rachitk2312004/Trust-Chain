import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminTenantAnalytics } from "../../types/api";

export function AdminTenantMetrics({ data }: { data: AdminTenantAnalytics | undefined }) {
  if (!data) return <FormHint>No tenant metrics.</FormHint>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenant metrics</CardTitle>
        <CardDescription>
          {data.total} tenants · last {data.days} days
        </CardDescription>
      </CardHeader>
      <div className="mb-3 flex flex-wrap gap-2">
        {Object.entries(data.byStatus).map(([status, count]) => (
          <Badge key={status}>
            {status}: {count}
          </Badge>
        ))}
      </div>
      <dl className="grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-[var(--tc-muted)]">Suspension rate</dt>
          <dd>{data.lifecycle.suspensionRate ?? "—"}%</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Restoration rate</dt>
          <dd>{data.lifecycle.restorationRate ?? "—"}%</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Transfer rate</dt>
          <dd>{data.lifecycle.transferRate ?? "—"}%</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Suspend events</dt>
          <dd>{data.lifecycle.suspensionEvents}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Restore events</dt>
          <dd>{data.lifecycle.restorationEvents}</dd>
        </div>
        <div>
          <dt className="text-[var(--tc-muted)]">Transfer events</dt>
          <dd>{data.lifecycle.transferEvents}</dd>
        </div>
      </dl>
      <FormHint>
        Quota coverage {data.quotas.tenantsWithQuota} · over limit {data.quotas.overLimitTenants}
      </FormHint>
    </Card>
  );
}
