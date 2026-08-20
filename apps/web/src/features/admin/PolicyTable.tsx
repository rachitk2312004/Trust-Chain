import { Link } from "react-router-dom";
import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { AdminPolicy } from "../../types/api";

function statusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "draft") return "info" as const;
  if (status === "disabled") return "neutral" as const;
  return "neutral" as const;
}

export function PolicyTable({
  policies,
  emptyMessage = "No policies found.",
}: {
  policies: AdminPolicy[];
  emptyMessage?: string;
}) {
  if (policies.length === 0) {
    return <FormHint>{emptyMessage}</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Code</TH>
          <TH>Type</TH>
          <TH>Status</TH>
          <TH>Priority</TH>
          <TH>Assignments</TH>
        </TR>
      </THead>
      <TBody>
        {policies.map((policy) => (
          <TR key={policy.id}>
            <TD>
              <Link
                to={`/admin/policies/${policy.id}`}
                className="text-[var(--tc-accent)] hover:underline"
              >
                {policy.name}
              </Link>
            </TD>
            <TD className="font-mono text-xs">{policy.publicCode}</TD>
            <TD>{policy.policyType}</TD>
            <TD>
              <Badge tone={statusTone(policy.status)}>{policy.status}</Badge>
            </TD>
            <TD>{policy.priority}</TD>
            <TD>{policy.assignments.length}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
