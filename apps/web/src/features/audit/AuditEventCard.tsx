import { Badge } from "@trustchain/ui";
import type { PlatformAuditEvent } from "../../services/auditApi";

export function AuditEventCard({
  event,
  onSelectCorrelation,
}: {
  event: PlatformAuditEvent;
  onSelectCorrelation?: (correlationId: string) => void;
}) {
  return (
    <article className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone={event.success ? "success" : "danger"}>
          {event.success ? "ok" : "fail"}
        </Badge>
        <Badge tone="neutral">{event.source}</Badge>
        <span className="font-mono text-xs text-[var(--tc-muted)]">{event.action}</span>
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--tc-muted)]">When</dt>
          <dd>{new Date(event.createdAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--tc-muted)]">Actor</dt>
          <dd className="font-mono text-xs">
            {event.actorUserId ? `${event.actorUserId.slice(0, 8)}…` : "—"}
            {event.actorIp ? ` · ${event.actorIp}` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--tc-muted)]">Resource</dt>
          <dd className="font-mono text-xs">
            {event.resourceType ?? "—"}
            {event.resourceId ? ` · ${event.resourceId.slice(0, 8)}…` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--tc-muted)]">Correlation</dt>
          <dd>
            {onSelectCorrelation ? (
              <button
                type="button"
                className="font-mono text-xs text-[var(--tc-accent)] hover:underline"
                onClick={() => onSelectCorrelation(event.correlationId)}
              >
                {event.correlationId.slice(0, 18)}…
              </button>
            ) : (
              <span className="font-mono text-xs">{event.correlationId.slice(0, 18)}…</span>
            )}
          </dd>
        </div>
      </dl>
      {event.requestId ? (
        <p className="mt-2 text-xs text-[var(--tc-muted)]">Request {event.requestId}</p>
      ) : null}
    </article>
  );
}
