import { Link } from "react-router-dom";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import {
  HealthStatusCard,
  MetricsPanel,
  ReadinessReportCard,
  usePlatformHealth,
  usePlatformMetrics,
  usePlatformReadiness,
} from "../features/platform";

export function PlatformDashboardPage() {
  const { isSuperAdmin } = usePermissions();
  const health = usePlatformHealth(isSuperAdmin);
  const readiness = usePlatformReadiness(isSuperAdmin);
  const metrics = usePlatformMetrics(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Platform" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Platform"
        description="Production hardening — health, readiness, and operational metrics."
        actions={
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void health.refetch();
                void readiness.refetch();
                void metrics.refetch();
              }}
            >
              Refresh
            </Button>
            <Link
              to="/platform/operations"
              className="text-sm text-[var(--tc-accent)] hover:underline"
            >
              Operations
            </Link>
          </div>
        }
      />

      {health.isError ? <FormError>{getApiErrorMessage(health.error)}</FormError> : null}
      {readiness.isError ? (
        <FormError>{getApiErrorMessage(readiness.error)}</FormError>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-soft">
          {health.isLoading || !health.data ? (
            <p className="text-sm text-tc-muted">Loading health…</p>
          ) : (
            <HealthStatusCard health={health.data} />
          )}
        </section>
        <section className="rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-soft">
          {readiness.isLoading || !readiness.data ? (
            <p className="text-sm text-tc-muted">Loading readiness…</p>
          ) : (
            <ReadinessReportCard report={readiness.data} />
          )}
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-tc-border bg-tc-surface p-6 shadow-soft">
        <h2 className="mb-4 font-display text-lg font-semibold tracking-tight text-tc-fg">
          Metrics
        </h2>
        {metrics.isLoading || !metrics.data ? (
          <p className="text-sm text-tc-muted">Loading metrics…</p>
        ) : (
          <MetricsPanel metrics={metrics.data.metrics} tracing={metrics.data.tracing} />
        )}
      </section>
    </AdminShellLayout>
  );
}
