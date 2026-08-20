import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { RecoveryPolicy } from "../../services/recoveryApi";

export function BackupPolicyTable({ policies }: { policies: RecoveryPolicy[] }) {
  if (policies.length === 0) {
    return <FormHint>No backup policies yet. Create one when running a backup.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Frequency</TH>
          <TH>RPO</TH>
          <TH>RTO</TH>
          <TH>Retention</TH>
          <TH>Region</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <TBody>
        {policies.map((p) => (
          <TR key={p.id}>
            <TD>
              <div className="font-medium">{p.name}</div>
              <div className="truncate text-xs text-[var(--tc-muted)]">
                {p.scopes.join(", ") || "—"}
              </div>
            </TD>
            <TD className="font-mono text-xs">{p.frequency}</TD>
            <TD className="text-xs">{p.rpoMinutes}m</TD>
            <TD className="text-xs">{p.rtoMinutes}m</TD>
            <TD className="text-xs">{p.retentionDays}d</TD>
            <TD className="font-mono text-xs">{p.regionCode}</TD>
            <TD>
              <Badge tone={p.enabled ? "success" : "neutral"}>
                {p.enabled ? "enabled" : "disabled"}
              </Badge>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
