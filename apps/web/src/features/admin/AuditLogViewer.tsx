import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { AdminAuditEvent } from "../../types/api";

export function AuditLogViewer({
  events,
  emptyMessage = "No audit events yet.",
}: {
  events: AdminAuditEvent[];
  emptyMessage?: string;
}) {
  if (events.length === 0) {
    return <FormHint>{emptyMessage}</FormHint>;
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
        {events.map((event) => (
          <TR key={event.id}>
            <TD className="whitespace-nowrap text-xs">
              {new Date(event.createdAt).toLocaleString()}
            </TD>
            <TD className="font-mono text-xs">{event.action}</TD>
            <TD className="text-xs">
              {event.targetType ?? "—"}
              {event.targetId ? (
                <span className="ml-1 font-mono text-[10px] text-[var(--tc-muted)]">
                  {event.targetId.slice(0, 8)}
                </span>
              ) : null}
            </TD>
            <TD className="font-mono text-xs">
              {event.actorUserId ? event.actorUserId.slice(0, 8) : "—"}
            </TD>
            <TD>
              <Badge tone={event.success ? "success" : "danger"}>
                {event.success ? "ok" : "fail"}
              </Badge>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
