import { Link } from "react-router-dom";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { PermissionEditor, useAdminPermissions, useAdminRoles } from "../features/admin";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { usePermissions } from "../hooks/usePermissions";

export function AdminPermissionsPage() {
  const { isSuperAdmin } = usePermissions();
  const permissions = useAdminPermissions(isSuperAdmin);
  const roles = useAdminRoles(isSuperAdmin);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Admin permissions" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  return (
    <AdminShellLayout>
      <PageHeader
        title="Admin permissions"
        description="Role catalog and capability assignment."
        actions={
          <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />

      {(permissions.isError || roles.isError) && (
        <FormError>
          {getApiErrorMessage(permissions.error ?? roles.error)}
        </FormError>
      )}

      <div className="mb-4">
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>Seeded platform roles and binding counts</CardDescription>
          </CardHeader>
          {roles.isLoading ? (
            <FormHint>Loading roles…</FormHint>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Key</TH>
                  <TH>Name</TH>
                  <TH>Bindings</TH>
                </TR>
              </THead>
              <TBody>
                {(roles.data ?? []).map((role) => (
                  <TR key={role.id}>
                    <TD className="font-mono text-xs">{role.key}</TD>
                    <TD>{role.name}</TD>
                    <TD>{role.bindingCount}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {permissions.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading permissions…</p>
      ) : (
        <PermissionEditor permissions={permissions.data} />
      )}
    </AdminShellLayout>
  );
}
