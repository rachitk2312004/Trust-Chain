import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  AnomalyPanel,
  ErrorRateChart,
  LatencyChart,
  QuotaCard,
  UsageChart,
  useDeveloperAnalytics,
  useDeveloperQuotas,
} from "../features/developer";

export function DeveloperAnalyticsPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const analytics = useDeveloperAnalytics(organizationId, 30, canManage);
  const quotas = useDeveloperQuotas(organizationId, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Developer analytics" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Developer analytics" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  const data = analytics.data;

  return (
    <AppShellLayout>
      <PageHeader
        title="Developer analytics"
        description="Request volume, latency, errors, quotas, and anomaly signals for the public API."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/developer/audit" className="text-[var(--tc-accent)] hover:underline">
              Audit
            </Link>
            <Link to="/developer/usage" className="text-[var(--tc-accent)] hover:underline">
              Usage log
            </Link>
            <Link to="/developer" className="text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      {analytics.isError ? <FormError>{getApiErrorMessage(analytics.error)}</FormError> : null}
      {quotas.isError ? <FormError>{getApiErrorMessage(quotas.error)}</FormError> : null}

      {analytics.isLoading || !data ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading analytics…</p>
      ) : (
        <div className="space-y-10">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Requests" value={String(data.totals.requests)} />
            <Stat label="Success" value={String(data.totals.success)} />
            <Stat label="Error rate" value={`${(data.totals.errorRate * 100).toFixed(1)}%`} />
            <Stat
              label="p95 latency"
              value={data.totals.p95DurationMs != null ? `${data.totals.p95DurationMs}ms` : "—"}
            />
          </section>

          <section className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Usage
              </h2>
              <UsageChart series={data.usage} />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Error rate
              </h2>
              <ErrorRateChart
                errorRate={data.errors.errorRate}
                errors={data.errors.errors}
                totalRequests={data.errors.totalRequests}
                byStatus={data.errors.byStatus}
                byPath={data.errors.byPath}
              />
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-2">
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Latency
              </h2>
              <LatencyChart
                avgMs={data.latency.avgMs}
                p50Ms={data.latency.p50Ms}
                p95Ms={data.latency.p95Ms}
                p99Ms={data.latency.p99Ms}
                byPath={data.latency.byPath}
              />
            </div>
            <div>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Quotas
              </h2>
              {quotas.data?.quotas[0] ? (
                <QuotaCard quota={quotas.data.quotas[0]} />
              ) : (
                <FormHint>No quota configured yet.</FormHint>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Anomalies
            </h2>
            <AnomalyPanel anomalies={data.anomalies ?? []} />
          </section>

          {data.monitoring ? (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
                Monitoring · {data.monitoring.status}
              </h2>
              <p className="text-sm text-[var(--tc-muted)]">
                {data.monitoring.requests} requests · error rate{" "}
                {(data.monitoring.errorRate * 100).toFixed(1)}% · p95{" "}
                {data.monitoring.p95LatencyMs ?? "—"}ms
              </p>
            </section>
          ) : null}
        </div>
      )}
    </AppShellLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
