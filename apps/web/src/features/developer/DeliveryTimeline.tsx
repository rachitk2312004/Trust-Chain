import { Badge, FormHint } from "@trustchain/ui";
import type { DeveloperWebhookDelivery } from "../../types/api";

function statusTone(status: string) {
  if (status === "success") return "success" as const;
  if (status === "failed") return "danger" as const;
  if (status === "retrying") return "warning" as const;
  return "neutral" as const;
}

export function DeliveryTimeline({
  delivery,
}: {
  delivery: DeveloperWebhookDelivery & {
    payload?: unknown;
    responseBody?: string | null;
  };
}) {
  const steps = [
    {
      label: "Created",
      detail: new Date(delivery.createdAt).toLocaleString(),
      done: true,
    },
    {
      label: "Scheduled",
      detail: delivery.nextRetryAt
        ? `Next attempt ${new Date(delivery.nextRetryAt).toLocaleString()}`
        : delivery.status === "pending"
          ? "Awaiting dispatch"
          : "—",
      done: Boolean(delivery.nextRetryAt) || delivery.attemptCount > 0 || delivery.status !== "pending",
    },
    {
      label: "Attempts",
      detail: `${delivery.attemptCount} attempt(s)`,
      done: delivery.attemptCount > 0,
    },
    {
      label: "Outcome",
      detail:
        delivery.status === "success"
          ? `HTTP ${delivery.responseStatus ?? 200}`
          : delivery.status === "failed"
            ? delivery.error ?? "Dead-lettered"
            : delivery.status,
      done: delivery.status === "success" || delivery.status === "failed",
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge tone={statusTone(delivery.status)}>{delivery.status}</Badge>
        <span className="font-mono text-xs text-[var(--tc-muted)]">{delivery.id}</span>
      </div>

      <ol className="space-y-3 border-l border-[var(--tc-border)] pl-4">
        {steps.map((step) => (
          <li key={step.label} className="relative">
            <span
              className={`absolute -left-[1.35rem] mt-1 h-2.5 w-2.5 rounded-full ${
                step.done ? "bg-[var(--tc-accent)]" : "bg-[var(--tc-border)]"
              }`}
            />
            <div className="text-sm font-medium">{step.label}</div>
            <div className="text-xs text-[var(--tc-muted)]">{step.detail}</div>
          </li>
        ))}
      </ol>

      {delivery.error ? (
        <FormHint>
          Error: <span className="font-mono text-xs">{delivery.error}</span>
        </FormHint>
      ) : null}

      {delivery.payload !== undefined ? (
        <div>
          <div className="mb-1 text-sm font-medium">Payload</div>
          <pre className="max-h-48 overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
            {JSON.stringify(delivery.payload, null, 2)}
          </pre>
        </div>
      ) : null}

      {delivery.responseBody ? (
        <div>
          <div className="mb-1 text-sm font-medium">Response body</div>
          <pre className="max-h-32 overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
            {delivery.responseBody}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
