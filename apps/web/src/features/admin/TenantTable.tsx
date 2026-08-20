import { Link } from "react-router-dom";
import { Button, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { AdminTenantSummary } from "../../types/api";
import { AdminStatusCell } from "./AdminEntityDialog";

export function TenantTable({
  tenants,
  emptyMessage = "No tenants found.",
  onEdit,
  onLifecycle,
}: {
  tenants: AdminTenantSummary[];
  emptyMessage?: string;
  onEdit?: (tenant: AdminTenantSummary) => void;
  onLifecycle?: (tenant: AdminTenantSummary) => void;
}) {
  if (tenants.length === 0) {
    return <p className="text-sm text-[var(--tc-muted)]">{emptyMessage}</p>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Slug</TH>
          <TH>Status</TH>
          <TH>Users</TH>
          <TH>Docs</TH>
          <TH>Certs</TH>
          <TH>Sigs</TH>
          <TH>Actions</TH>
        </TR>
      </THead>
      <TBody>
        {tenants.map((tenant) => (
          <TR key={tenant.id}>
            <TD>
              <Link
                to={`/admin/tenants/${tenant.id}`}
                className="text-[var(--tc-accent)] hover:underline"
              >
                {tenant.name}
              </Link>
            </TD>
            <TD className="font-mono text-xs">{tenant.slug}</TD>
            <TD>
              <AdminStatusCell entity="tenant" status={tenant.status} />
            </TD>
            <TD>{tenant.counts.users}</TD>
            <TD>{tenant.counts.documents}</TD>
            <TD>{tenant.counts.certificates}</TD>
            <TD>{tenant.counts.signatures}</TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => onEdit?.(tenant)}>
                  Edit
                </Button>
                <Button size="sm" variant="secondary" onClick={() => onLifecycle?.(tenant)}>
                  Lifecycle
                </Button>
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
