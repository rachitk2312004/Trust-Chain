import { Link } from "react-router-dom";
import { useState } from "react";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  AdminEditDialog,
  AdminLifecycleDialog,
  OrganizationTable,
  useAdminOrganizations,
  useDeleteAdminOrganization,
  usePatchAdminOrganization,
  useRestoreAdminOrganization,
  useSuspendAdminOrganization,
} from "../features/admin";
import type { AdminLifecycleTarget } from "../features/admin/AdminEntityDialog";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import type { AdminOrganizationSummary } from "../types/api";

export function AdminOrganizationsPage() {
  const { isSuperAdmin } = usePermissions();
  const organizations = useAdminOrganizations({ limit: 100 }, isSuperAdmin);
  const feedback = useFeedback();
  const suspend = useSuspendAdminOrganization();
  const restore = useRestoreAdminOrganization();
  const remove = useDeleteAdminOrganization();
  const patch = usePatchAdminOrganization();

  const [lifecycleTarget, setLifecycleTarget] = useState<AdminLifecycleTarget | null>(null);
  const [editOrg, setEditOrg] = useState<AdminOrganizationSummary | null>(null);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Admin organizations" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  const lifecyclePending = suspend.isPending || restore.isPending || remove.isPending;
  const lifecycleError = suspend.error ?? restore.error ?? remove.error;

  return (
    <AdminShellLayout>
      <PageHeader
        title="Admin organizations"
        description="Inspect organizations, membership counts, and bindings."
        actions={
          <div className="flex items-center gap-3">
            <Link to="/admin/tenants" className="text-sm font-medium text-[var(--tc-accent)] hover:underline">
              Provision tenant
            </Link>
            <Link to="/admin" className="text-sm text-[var(--tc-muted)] hover:underline">
              Dashboard
            </Link>
          </div>
        }
      />
      {organizations.isError ? (
        <FormError>{getApiErrorMessage(organizations.error)}</FormError>
      ) : null}
      {organizations.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading organizations…</p>
      ) : (
        <OrganizationTable
          organizations={organizations.data?.organizations ?? []}
          onEdit={setEditOrg}
          onLifecycle={(org) =>
            setLifecycleTarget({
              kind: "organization",
              id: org.id,
              label: org.name,
              status: org.status,
            })
          }
        />
      )}

      <AdminLifecycleDialog
        open={Boolean(lifecycleTarget)}
        onClose={() => setLifecycleTarget(null)}
        target={lifecycleTarget}
        pending={lifecyclePending}
        error={lifecycleError}
        onSuspend={(input) =>
          suspend.mutate(
            { organizationId: input.id, reason: input.reason },
            {
              onSuccess: (data) => {
                feedback.success(data.message);
                setLifecycleTarget(null);
              },
            },
          )
        }
        onRestore={(input) =>
          restore.mutate(
            { organizationId: input.id, reason: input.reason },
            {
              onSuccess: (data) => {
                feedback.success(data.message);
                setLifecycleTarget(null);
              },
            },
          )
        }
        onDelete={(input) =>
          remove.mutate(
            { organizationId: input.id, reason: input.reason },
            {
              onSuccess: (data) => {
                feedback.success(data.message);
                setLifecycleTarget(null);
              },
            },
          )
        }
      />

      <AdminEditDialog
        open={Boolean(editOrg)}
        onClose={() => setEditOrg(null)}
        title="Edit organization"
        pending={patch.isPending}
        error={patch.error}
        fields={
          editOrg
            ? [
                { key: "name", label: "Name", value: editOrg.name },
                { key: "slug", label: "Slug", value: editOrg.slug, mono: true },
              ]
            : []
        }
        onSave={(values) => {
          if (!editOrg) return;
          patch.mutate(
            {
              organizationId: editOrg.id,
              body: { name: values.name?.trim() ?? "", slug: values.slug?.trim() ?? "" },
            },
            {
              onSuccess: () => {
                feedback.success("Organization updated");
                setEditOrg(null);
              },
            },
          );
        }}
      />
    </AdminShellLayout>
  );
}
