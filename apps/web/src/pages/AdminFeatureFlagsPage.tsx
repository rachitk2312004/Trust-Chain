import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { FeatureFlagEditor, useAdminFeatureFlags } from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";

export function AdminFeatureFlagsPage() {
  const { isSuperAdmin } = usePermissions();
  const flags = useAdminFeatureFlags(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Feature flags" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Feature flags"
        description="Create and manage platform feature flags."
        actions={
          <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />
      {flags.isError ? <FormError>{getApiErrorMessage(flags.error)}</FormError> : null}
      {flags.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading feature flags…</p>
      ) : (
        <FeatureFlagEditor flags={flags.data} />
      )}
    </AdminShellLayout>
  );
}
