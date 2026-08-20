import { Link } from "react-router-dom";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";
import { useSessionStore } from "../lib/sessionStore";
import {
  RoleEditor,
  useCreateEnterpriseRole,
  useEnterpriseRoles,
} from "../features/enterprise";

export function EnterpriseRolesPage() {
  const organizationId = useSessionStore((s) => s.activeOrganizationId);
  const { isOrgAdmin, isSuperAdmin } = usePermissions();
  const canManage = isOrgAdmin || isSuperAdmin;
  const roles = useEnterpriseRoles(organizationId, canManage);
  const create = useCreateEnterpriseRole();

  if (!organizationId) {
    return (
      <AppShellLayout>
        <PageHeader title="Enterprise roles" />
        <FormHint>Select an organization first.</FormHint>
      </AppShellLayout>
    );
  }

  if (!canManage) {
    return (
      <AppShellLayout>
        <PageHeader title="Enterprise roles" />
        <FormHint>Organization admin access is required.</FormHint>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <PageHeader
        title="Enterprise roles"
        description="Org-scoped roles with inheritance, permissions, and ABAC-ready assignment."
        actions={
          <Link to="/enterprise" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {roles.isError ? <FormError>{getApiErrorMessage(roles.error)}</FormError> : null}
      {create.isError ? <FormError>{getApiErrorMessage(create.error)}</FormError> : null}

      {roles.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading roles…</p>
      ) : (
        <RoleEditor
          roles={roles.data?.roles ?? []}
          pending={create.isPending}
          onCreate={(input) =>
            create.mutate({
              organizationId,
              ...input,
            })
          }
        />
      )}
    </AppShellLayout>
  );
}
