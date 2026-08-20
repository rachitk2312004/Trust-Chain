import { Link } from "react-router-dom";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { HealthPanel, useAdminHealth } from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";

export function AdminHealthPage() {
  const { isSuperAdmin } = usePermissions();
  const health = useAdminHealth(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Admin health" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Admin health"
        description="Database, audit store, and configuration store probes."
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void health.refetch()}>
              Refresh
            </Button>
            <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />
      {health.isError ? <FormError>{getApiErrorMessage(health.error)}</FormError> : null}
      {health.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Checking health…</p>
      ) : (
        <HealthPanel report={health.data} />
      )}
    </AdminShellLayout>
  );
}
