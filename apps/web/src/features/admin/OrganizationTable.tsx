import { Button, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { AdminOrganizationSummary } from "../../types/api";
import { AdminStatusCell } from "./AdminEntityDialog";

export function OrganizationTable({
  organizations,
  emptyMessage = "No organizations found.",
  onEdit,
  onLifecycle,
}: {
  organizations: AdminOrganizationSummary[];
  emptyMessage?: string;
  onEdit?: (org: AdminOrganizationSummary) => void;
  onLifecycle?: (org: AdminOrganizationSummary) => void;
}) {
  if (organizations.length === 0) {
    return <p className="text-sm text-[var(--tc-muted)]">{emptyMessage}</p>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Slug</TH>
          <TH>Status</TH>
          <TH>Members</TH>
          <TH>Bindings</TH>
          <TH>Documents</TH>
          <TH>Actions</TH>
        </TR>
      </THead>
      <TBody>
        {organizations.map((org) => (
          <TR key={org.id}>
            <TD>{org.name}</TD>
            <TD className="font-mono text-xs">{org.slug}</TD>
            <TD>
              <AdminStatusCell entity="organization" status={org.status} />
            </TD>
            <TD>{org.counts.memberships}</TD>
            <TD>{org.counts.roleBindings}</TD>
            <TD>{org.counts.documents}</TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={org.status === "deleted"}
                  onClick={() => onEdit?.(org)}
                >
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onLifecycle?.(org)}>
                  Manage
                </Button>
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
