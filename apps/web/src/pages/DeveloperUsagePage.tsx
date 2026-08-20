import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  ApiRequestTable,
  UsageMetricsCard,
  useDeveloperUsage,
} from "../features/developer";

export function DeveloperUsagePage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const usage = useDeveloperUsage(organizationId, { days: 30 }, canManage);

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="API usage" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="API usage" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="API usage"
        description="Public API request volume, errors, and recent calls for this organization."
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <Link to="/developer/explorer" className="text-[var(--tc-accent)] hover:underline">
              API explorer
            </Link>
            <Link to="/developer" className="text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />

      {usage.isError ? <FormError>{getApiErrorMessage(usage.error)}</FormError> : null}
      {usage.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading usage…</p>
      ) : (
        <div className="space-y-8">
          <UsageMetricsCard metrics={usage.data?.metrics} />
          <section>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
              Recent requests
            </h2>
            <ApiRequestTable requests={usage.data?.requests ?? []} />
          </section>
        </div>
      )}
    </AppShellLayout>
  );
}
