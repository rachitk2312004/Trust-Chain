import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { RetentionPolicy } from "../../services/retentionApi";

export function RetentionPolicyTable({ policies }: { policies: RetentionPolicy[] }) {
  if (policies.length === 0) {
    return <FormHint>No retention policies configured.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Target</TH>
          <TH>Days</TH>
          <TH>Disposition</TH>
          <TH>Status</TH>
          <TH>Priority</TH>
        </TR>
      </THead>
      <TBody>
        {policies.map((p) => (
          <TR key={p.id}>
            <TD>
              <div className="font-medium">{p.name}</div>
              {p.description ? (
                <div className="text-xs text-[var(--tc-muted)]">{p.description}</div>
              ) : null}
            </TD>
            <TD className="font-mono text-xs">{p.targetType}</TD>
            <TD>{p.retentionDays}</TD>
            <TD>
              <Badge tone={p.disposition === "purge" ? "danger" : "neutral"}>
                {p.disposition}
              </Badge>
            </TD>
            <TD>
              <Badge tone={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge>
            </TD>
            <TD className="text-xs">{p.priority}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
