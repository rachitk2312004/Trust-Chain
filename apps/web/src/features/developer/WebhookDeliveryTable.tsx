import { Badge, FormHint, Table, TBody, TD, TH, THead, TR, Button } from "@trustchain/ui";
import type { DeveloperWebhookDelivery } from "../../types/api";

function statusTone(status: string) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "retrying") return "warning" as const;
  return "neutral" as const;
}

export function WebhookDeliveryTable({
  deliveries,
  onReplay,
  onSelect,
  busyId,
}: {
  deliveries: DeveloperWebhookDelivery[];
  onReplay?: (delivery: DeveloperWebhookDelivery) => void;
  onSelect?: (delivery: DeveloperWebhookDelivery) => void;
  busyId?: string | null;
}) {
  if (deliveries.length === 0) {
    return <FormHint>No deliveries yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Event</TH>
          <TH>Status</TH>
          <TH>Attempts</TH>
          <TH>HTTP</TH>
          <TH>Created</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {deliveries.map((delivery) => (
          <TR key={delivery.id}>
            <TD>
              <div className="text-sm">{delivery.eventType}</div>
              <div className="font-mono text-xs text-[var(--tc-muted)]">{delivery.id.slice(0, 8)}…</div>
            </TD>
            <TD>
              <Badge tone={statusTone(delivery.status)}>{delivery.status}</Badge>
            </TD>
            <TD>{delivery.attemptCount}</TD>
            <TD>{delivery.responseStatus ?? "—"}</TD>
            <TD className="text-xs text-[var(--tc-muted)]">
              {new Date(delivery.createdAt).toLocaleString()}
            </TD>
            <TD>
              <div className="flex gap-1">
                {onSelect ? (
                  <Button size="sm" variant="ghost" onClick={() => onSelect(delivery)}>
                    Details
                  </Button>
                ) : null}
                {onReplay ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === delivery.id}
                    onClick={() => onReplay(delivery)}
                  >
                    Replay
                  </Button>
                ) : null}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
