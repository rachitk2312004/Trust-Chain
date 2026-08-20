import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import { Link } from "react-router-dom";
import type { DeveloperWebhook } from "../../types/api";

function statusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "failing") return "danger" as const;
  return "neutral" as const;
}

export function WebhookTable({
  webhooks,
  onDisable,
  onRotateSecret,
  busyId,
}: {
  webhooks: DeveloperWebhook[];
  onDisable?: (webhook: DeveloperWebhook) => void;
  onRotateSecret?: (webhook: DeveloperWebhook) => void;
  busyId?: string | null;
}) {
  if (webhooks.length === 0) {
    return <FormHint>No webhooks registered.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>URL</TH>
          <TH>Events</TH>
          <TH>Status</TH>
          <TH>Failures</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {webhooks.map((webhook) => (
          <TR key={webhook.id}>
            <TD>
              <Link
                to={`/developer/webhooks/${webhook.id}`}
                className="text-[var(--tc-accent)] hover:underline"
              >
                {webhook.name}
              </Link>
              <div className="font-mono text-xs text-[var(--tc-muted)]">
                {webhook.publicCode}
              </div>
            </TD>
            <TD className="max-w-[220px] truncate text-xs">{webhook.url}</TD>
            <TD className="text-xs">{webhook.events.join(", ")}</TD>
            <TD>
              <Badge tone={statusTone(webhook.status)}>{webhook.status}</Badge>
            </TD>
            <TD>{webhook.failureCount}</TD>
            <TD>
              <div className="flex gap-1">
                <Link
                  to={`/developer/webhooks/${webhook.id}`}
                  className="inline-flex items-center px-2 text-sm text-[var(--tc-accent)] hover:underline"
                >
                  Deliveries
                </Link>
                {onRotateSecret ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === webhook.id}
                    onClick={() => onRotateSecret(webhook)}
                  >
                    Rotate secret
                  </Button>
                ) : null}
                {webhook.status === "active" && onDisable ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === webhook.id}
                    onClick={() => onDisable(webhook)}
                  >
                    Disable
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
