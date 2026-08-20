import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";

export type AuditEventRow = {
  id: string;
  action: string;
  actorUserId: string | null;
  targetType: string | null;
  targetId: string | null;
  success: boolean;
  createdAt: string;
};

export function AuditTable({ events }: { events: AuditEventRow[] }) {
  if (events.length === 0) {
    return <FormHint>No developer audit events match these filters.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>When</TH>
          <TH>Action</TH>
          <TH>Target</TH>
          <TH>Actor</TH>
          <TH>Result</TH>
        </TR>
      </THead>
      <TBody>
        {events.map((row) => (
          <TR key={row.id}>
            <TD className="text-xs text-[var(--tc-muted)]">
              {new Date(row.createdAt).toLocaleString()}
            </TD>
            <TD className="font-mono text-xs">{row.action}</TD>
            <TD className="max-w-[200px] truncate text-xs">
              {row.targetType ?? "—"}
              {row.targetId ? ` · ${row.targetId.slice(0, 8)}…` : ""}
            </TD>
            <TD className="font-mono text-xs text-[var(--tc-muted)]">
              {row.actorUserId ? `${row.actorUserId.slice(0, 8)}…` : "—"}
            </TD>
            <TD>
              <Badge tone={row.success ? "success" : "danger"}>
                {row.success ? "ok" : "fail"}
              </Badge>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
