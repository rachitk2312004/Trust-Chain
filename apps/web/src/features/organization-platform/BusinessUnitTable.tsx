import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { OrgBusinessUnit } from "../../services/organizationPlatformApi";

export function BusinessUnitTable({ units }: { units: OrgBusinessUnit[] }) {
  if (units.length === 0) {
    return <FormHint>No business units yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Key</TH>
          <TH>Parent</TH>
          <TH>Owner</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <TBody>
        {units.map((u) => (
          <TR key={u.id}>
            <TD>
              <div className="font-medium">{u.name}</div>
              {u.description ? (
                <div className="text-xs text-[var(--tc-muted)]">{u.description}</div>
              ) : null}
            </TD>
            <TD className="font-mono text-xs">{u.key}</TD>
            <TD className="font-mono text-xs">{u.parentUnitId?.slice(0, 8) ?? "—"}</TD>
            <TD className="font-mono text-xs">{u.ownerUserId?.slice(0, 8) ?? "—"}</TD>
            <TD>
              <Badge tone={u.status === "active" ? "success" : "neutral"}>{u.status}</Badge>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
