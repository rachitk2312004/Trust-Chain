import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminAnalyticsSummary, AdminGrowthBucket } from "../../types/api";

function formatRate(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value}%`;
}

function GrowthSpark({ series }: { series: AdminGrowthBucket[] }) {
  const total = series.reduce((a, b) => a + b.count, 0);
  if (series.length === 0) return <FormHint>No growth data.</FormHint>;
  const max = Math.max(1, ...series.map((b) => b.count));
  return (
    <div>
      <div className="mb-1 flex h-10 items-end gap-0.5">
        {series.map((bucket) => (
          <div
            key={bucket.date}
            title={`${bucket.date}: ${bucket.count}`}
            className="flex-1 rounded-sm bg-[var(--tc-accent)]/70"
            style={{ height: `${Math.max(8, (bucket.count / max) * 100)}%` }}
          />
        ))}
      </div>
      <FormHint>
        {total} new over {series.length} days
      </FormHint>
    </div>
  );
}

export function AdminMetricsPanel({ summary }: { summary: AdminAnalyticsSummary | undefined }) {
  if (!summary) return <FormHint>No analytics summary.</FormHint>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Tenants</CardTitle>
          <CardDescription>{summary.tenants.total} total</CardDescription>
        </CardHeader>
        <GrowthSpark series={summary.tenants.growth} />
        <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div>
            <dt className="text-[var(--tc-muted)]">Suspend</dt>
            <dd>{formatRate(summary.tenants.lifecycle.suspensionRate)}</dd>
          </div>
          <div>
            <dt className="text-[var(--tc-muted)]">Restore</dt>
            <dd>{formatRate(summary.tenants.lifecycle.restorationRate)}</dd>
          </div>
          <div>
            <dt className="text-[var(--tc-muted)]">Transfer</dt>
            <dd>{formatRate(summary.tenants.lifecycle.transferRate)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>{summary.users.total} total</CardDescription>
        </CardHeader>
        <GrowthSpark series={summary.users.growth} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>{summary.organizations.total} total</CardDescription>
        </CardHeader>
        <GrowthSpark series={summary.organizations.growth} />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotas</CardTitle>
          <CardDescription>
            {summary.quotas.tenantsWithQuota} with quotas ·{" "}
            <Badge tone={summary.quotas.overLimitTenants > 0 ? "warning" : "success"}>
              {summary.quotas.overLimitTenants} over limit
            </Badge>
          </CardDescription>
        </CardHeader>
        <ul className="space-y-1 text-sm">
          {Object.entries(summary.quotas.resources)
            .slice(0, 6)
            .map(([resource, row]) => (
              <li key={resource} className="flex justify-between gap-2">
                <span>{resource}</span>
                <span className="text-[var(--tc-muted)]">
                  {row.used}/{row.limit} · {formatRate(row.avgPercent)}
                </span>
              </li>
            ))}
        </ul>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configuration changes</CardTitle>
          <CardDescription>From audit trail</CardDescription>
        </CardHeader>
        <p className="text-2xl font-semibold">{summary.audit.configurationChanges}</p>
        <FormHint>
          Audit success rate {formatRate(summary.audit.successRate)} · {summary.audit.total} events
        </FormHint>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Process</CardTitle>
          <CardDescription>In-process counters</CardDescription>
        </CardHeader>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-[var(--tc-muted)]">Analytics reads</dt>
            <dd>{summary.process.analyticsReads}</dd>
          </div>
          <div>
            <dt className="text-[var(--tc-muted)]">Avg latency</dt>
            <dd>
              {summary.process.averageAnalyticsLatencyMs != null
                ? `${summary.process.averageAnalyticsLatencyMs}ms`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--tc-muted)]">Reprocess</dt>
            <dd>{summary.process.operationsReprocess}</dd>
          </div>
          <div>
            <dt className="text-[var(--tc-muted)]">Cleanup</dt>
            <dd>{summary.process.operationsCleanup}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
