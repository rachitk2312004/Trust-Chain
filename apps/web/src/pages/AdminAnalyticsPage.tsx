import { Link } from "react-router-dom";
import { useState } from "react";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import {
  AdminAuditMetrics,
  AdminFeatureMetrics,
  AdminMetricsPanel,
  AdminOperationsPanel,
  AdminPolicyMetrics,
  AdminTenantMetrics,
  useAdminAnalytics,
  useAdminAuditAnalytics,
  useAdminFeatureAnalytics,
  useAdminPolicyAnalytics,
  useAdminTenantAnalytics,
} from "../features/admin";

export function AdminAnalyticsPage() {
  const { isSuperAdmin } = usePermissions();
  const [days, setDays] = useState(30);
  const summary = useAdminAnalytics(days, isSuperAdmin);
  const tenants = useAdminTenantAnalytics(days, isSuperAdmin);
  const policies = useAdminPolicyAnalytics(isSuperAdmin);
  const audit = useAdminAuditAnalytics(isSuperAdmin);
  const features = useAdminFeatureAnalytics(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Analytics" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  const loading =
    summary.isLoading ||
    tenants.isLoading ||
    policies.isLoading ||
    audit.isLoading ||
    features.isLoading;

  return (
    <AdminShellLayout>
      <PageHeader
        title="Analytics & operations"
        description="Tenant growth, policy evaluations, audit activity, feature flags, retention, and repair tools."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <select
              className="h-9 rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-2 text-sm"
              value={days}
              onChange={(e) => setDays(Number.parseInt(e.target.value, 10) || 30)}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      {summary.isError ? <FormError>{getApiErrorMessage(summary.error)}</FormError> : null}
      {loading ? (
        <p className="mb-4 text-sm text-[var(--tc-muted)]">Loading analytics…</p>
      ) : null}

      <div className="mb-8">
        <AdminMetricsPanel summary={summary.data} />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <AdminTenantMetrics data={tenants.data} />
        <AdminPolicyMetrics data={policies.data} />
        <AdminAuditMetrics data={audit.data} />
        <AdminFeatureMetrics data={features.data} />
      </div>

      <AdminOperationsPanel />
    </AdminShellLayout>
  );
}
