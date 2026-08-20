import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { PlatformRegion } from "../../services/regionApi";

export function RegionTable({ regions }: { regions: PlatformRegion[] }) {
  if (regions.length === 0) {
    return <FormHint>No regions registered yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Code</TH>
          <TH>Name</TH>
          <TH>Jurisdiction</TH>
          <TH>Status</TH>
          <TH>Priority</TH>
          <TH>Latency</TH>
        </TR>
      </THead>
      <TBody>
        {regions.map((r) => (
          <TR key={r.id}>
            <TD className="font-mono text-xs">{r.code}</TD>
            <TD>
              <div className="font-medium">{r.name}</div>
              <div className="truncate text-xs text-[var(--tc-muted)]">{r.endpointUrl}</div>
            </TD>
            <TD className="font-mono text-xs">{r.jurisdiction}</TD>
            <TD>
              <Badge
                tone={
                  r.status === "active"
                    ? "success"
                    : r.status === "offline"
                      ? "danger"
                      : "neutral"
                }
              >
                {r.status}
              </Badge>
            </TD>
            <TD className="text-xs">{r.priority}</TD>
            <TD className="text-xs">{r.latencyWeight}</TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
