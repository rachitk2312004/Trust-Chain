import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { OrgDepartment } from "../../services/organizationPlatformApi";

export function DepartmentTable({ departments }: { departments: OrgDepartment[] }) {
  if (departments.length === 0) {
    return <FormHint>No departments yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Code</TH>
          <TH>Parent</TH>
          <TH>Owner</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <TBody>
        {departments.map((d) => (
          <TR key={d.id}>
            <TD>
              <div className="font-medium">{d.name}</div>
              {Object.keys(d.policy).length ? (
                <div className="font-mono text-[10px] text-[var(--tc-muted)]">
                  policy keys: {Object.keys(d.policy).join(", ")}
                </div>
              ) : null}
            </TD>
            <TD className="font-mono text-xs">{d.code ?? "—"}</TD>
            <TD className="font-mono text-xs">
              {d.parentDepartmentId?.slice(0, 8) ?? d.businessUnitId?.slice(0, 8) ?? "—"}
            </TD>
            <TD className="font-mono text-xs">{d.ownerUserId?.slice(0, 8) ?? "—"}</TD>
            <TD>
              <Badge tone={d.status === "active" ? "success" : "neutral"}>{d.status}</Badge>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
