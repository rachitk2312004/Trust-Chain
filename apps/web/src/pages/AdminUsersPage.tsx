import { Link } from "react-router-dom";
import { useState } from "react";
import { FormError, FormHint } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  AdminEditDialog,
  AdminLifecycleDialog,
  UserTable,
  useAdminUsers,
  usePatchAdminUser,
  useRestoreAdminUser,
  useSuspendAdminUser,
} from "../features/admin";
import type { AdminLifecycleTarget } from "../features/admin/AdminEntityDialog";
import { userIsSuperAdmin } from "../features/admin/adminStatus";
import { AdminShellLayout } from "../layouts/AdminShellLayout";
import { getApiErrorMessage } from "../lib/apiErrors";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import type { AdminUserSummary } from "../types/api";

export function AdminUsersPage() {
  const { isSuperAdmin } = usePermissions();
  const users = useAdminUsers({ limit: 100 }, isSuperAdmin);
  const feedback = useFeedback();
  const suspend = useSuspendAdminUser();
  const restore = useRestoreAdminUser();
  const patch = usePatchAdminUser();

  const [lifecycleTarget, setLifecycleTarget] = useState<AdminLifecycleTarget | null>(null);
  const [editUser, setEditUser] = useState<AdminUserSummary | null>(null);

  if (!isSuperAdmin) {
    return (
      <AdminShellLayout>
        <PageHeader title="Admin users" />
        <FormHint>Super admin access is required.</FormHint>
      </AdminShellLayout>
    );
  }

  const lifecyclePending = suspend.isPending || restore.isPending;
  const lifecycleError = suspend.error ?? restore.error;

  return (
    <AdminShellLayout>
      <PageHeader
        title="Admin users"
        description="Inspect platform users, roles, and memberships."
        actions={
          <Link to="/admin" className="text-sm text-[var(--tc-accent)] hover:underline">
            Dashboard
          </Link>
        }
      />
      {users.isError ? <FormError>{getApiErrorMessage(users.error)}</FormError> : null}
      {users.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading users…</p>
      ) : (
        <UserTable
          users={users.data?.users ?? []}
          onEdit={setEditUser}
          onLifecycle={(user) =>
            setLifecycleTarget({
              kind: "user",
              id: user.id,
              label: user.email,
              status: user.status,
              isSuperAdmin: userIsSuperAdmin(user.roles),
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
            { userId: input.id, reason: input.reason },
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
            { userId: input.id, reason: input.reason },
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
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title="Edit user"
        pending={patch.isPending}
        error={patch.error}
        fields={
          editUser
            ? [
                { key: "firstName", label: "First name", value: editUser.firstName ?? "" },
                { key: "lastName", label: "Last name", value: editUser.lastName ?? "" },
              ]
            : []
        }
        onSave={(values) => {
          if (!editUser) return;
          patch.mutate(
            {
              userId: editUser.id,
              body: {
                firstName: values.firstName?.trim() || null,
                lastName: values.lastName?.trim() || null,
              },
            },
            {
              onSuccess: () => {
                feedback.success("User updated");
                setEditUser(null);
              },
            },
          );
        }}
      />
    </AdminShellLayout>
  );
}
