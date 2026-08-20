import { Badge, FormHint } from "@trustchain/ui";
import type { PlatformAuditEvent } from "../../services/auditApi";

export type TimelineReplayItem = {
  sequence: number;
  linked: boolean;
  event: PlatformAuditEvent;
};

export function AuditTimeline({
  events,
  buckets,
  replay,
  chainValid,
}: {
  events: PlatformAuditEvent[];
  buckets?: Array<{ day: string; count: number; success: number; failure: number }>;
  replay?: TimelineReplayItem[];
  chainValid?: boolean;
}) {
  if (events.length === 0) {
    return <FormHint>No timeline events for this selection.</FormHint>;
  }

  const items = replay?.length
    ? replay
    : events.map((event, index) => ({
        sequence: index + 1,
        linked: true,
        event,
      }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Badge tone={chainValid === false ? "danger" : "success"}>
          {chainValid === false ? "Chain invalid" : "Chain valid"}
        </Badge>
        <span className="text-[var(--tc-muted)]">{events.length} events</span>
      </div>

      {buckets && buckets.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {buckets.map((b) => (
            <span
              key={b.day}
              className="rounded border border-[var(--tc-border)] px-2 py-1 text-xs text-[var(--tc-muted)]"
            >
              {b.day}: {b.count} ({b.success} ok / {b.failure} fail)
            </span>
          ))}
        </div>
      ) : null}

      <ol className="relative space-y-4 border-l border-[var(--tc-border)] pl-6">
        {items.map((item) => (
          <li key={item.event.id} className="relative">
            <span className="absolute -left-[1.6rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--tc-border)] bg-[var(--tc-bg)] text-[10px]">
              {item.sequence}
            </span>
            <div className="rounded border border-[var(--tc-border)] p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs">{item.event.action}</span>
                <Badge tone={item.event.success ? "success" : "danger"}>
                  {item.event.success ? "ok" : "fail"}
                </Badge>
                <Badge tone={item.linked ? "neutral" : "warning"}>
                  {item.linked ? "linked" : "broken link"}
                </Badge>
              </div>
              <p className="text-xs text-[var(--tc-muted)]">
                {new Date(item.event.createdAt).toLocaleString()} · {item.event.source}
                {item.event.requestId ? ` · ${item.event.requestId}` : ""}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
