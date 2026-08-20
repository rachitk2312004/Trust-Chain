import { Button, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { AdminUserSummary } from "../../types/api";
import { rolesForDisplay } from "../../lib/permissions";
import { AdminStatusCell } from "./AdminEntityDialog";
import { userIsSuperAdmin } from "./adminStatus";

export function UserTable({
  users,
  emptyMessage = "No users found.",
  onEdit,
  onLifecycle,
}: {
  users: AdminUserSummary[];
  emptyMessage?: string;
  onEdit?: (user: AdminUserSummary) => void;
  onLifecycle?: (user: AdminUserSummary) => void;
}) {
  if (users.length === 0) {
    return <p className="text-sm text-[var(--tc-muted)]">{emptyMessage}</p>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Email</TH>
          <TH>Name</TH>
          <TH>Status</TH>
          <TH>Roles</TH>
          <TH>Orgs</TH>
          <TH>Actions</TH>
        </TR>
      </THead>
      <TBody>
        {users.map((user) => {
          const roles = rolesForDisplay(user.roles);
          const locked = userIsSuperAdmin(user.roles);
          return (
            <TR key={user.id}>
              <TD className="font-mono text-xs">{user.email}</TD>
              <TD>{[user.firstName, user.lastName].filter(Boolean).join(" ") || "—"}</TD>
              <TD>
                <AdminStatusCell entity="user" status={user.status} />
              </TD>
              <TD className="text-xs">
                {roles.length ? roles.map((r) => r.roleKey).join(", ") : "—"}
              </TD>
              <TD className="text-xs">
                {user.memberships.length
                  ? user.memberships.map((m) => m.organizationSlug).join(", ")
                  : "—"}
              </TD>
              <TD>
                <div className="flex flex-wrap gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={locked}
                    onClick={() => onEdit?.(user)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={locked}
                    onClick={() => onLifecycle?.(user)}
                  >
                    Suspend / restore
                  </Button>
                </div>
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
