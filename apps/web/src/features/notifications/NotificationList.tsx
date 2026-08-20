import { Badge, Button, FormHint } from "@trustchain/ui";
import type { NotificationItem } from "../../types/api";
import { eventLabel } from "./NotificationFilters";

function emailTone(status: string | null): "neutral" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case "sent":
    case "delivered":
      return "success";
    case "pending":
      return "info";
    case "failed":
      return "danger";
    case "skipped":
      return "neutral";
    default:
      return "neutral";
  }
}

export function NotificationList({
  items,
  emptyMessage = "No notifications.",
  onMarkRead,
  onDelete,
  markingId,
  deletingId,
  highlightId,
}: {
  items: NotificationItem[];
  emptyMessage?: string;
  onMarkRead?: (id: string) => void;
  onDelete?: (id: string) => void;
  markingId?: string | null;
  deletingId?: string | null;
  /** Recently inserted live notification id for subtle highlight. */
  highlightId?: string | null;
}) {
  if (items.length === 0) {
    return <FormHint>{emptyMessage}</FormHint>;
  }

  return (
    <ul className="divide-y divide-[var(--tc-border)] rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)]">
      {items.map((item) => (
        <li
          key={item.id}
          data-notification-id={item.id}
          data-live-new={highlightId === item.id ? "true" : "false"}
          className={[
            "flex flex-col gap-2 px-4 py-3 transition-colors duration-300 sm:flex-row sm:items-start sm:justify-between",
            item.unread ? "bg-[var(--tc-surface-2)]" : "",
            highlightId === item.id ? "ring-1 ring-inset ring-[var(--tc-accent)]" : "",
          ].join(" ")}
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              {item.unread ? <Badge tone="info">Unread</Badge> : <Badge tone="neutral">Read</Badge>}
              <Badge tone="neutral">{eventLabel(item.eventType)}</Badge>
              {item.emailStatus ? (
                <Badge tone={emailTone(item.emailStatus)}>Email: {item.emailStatus}</Badge>
              ) : null}
            </div>
            <p className="text-sm font-medium text-[var(--tc-fg)]">{item.title}</p>
            <p className="mt-0.5 text-sm text-[var(--tc-muted)]">{item.body}</p>
            <p className="mt-1 text-xs text-[var(--tc-muted)]">
              {new Date(item.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {item.unread && onMarkRead ? (
              <Button
                size="sm"
                variant="secondary"
                disabled={markingId === item.id}
                onClick={() => onMarkRead(item.id)}
              >
                {markingId === item.id ? "…" : "Mark read"}
              </Button>
            ) : null}
            {onDelete ? (
              <Button
                size="sm"
                variant="ghost"
                disabled={deletingId === item.id}
                onClick={() => onDelete(item.id)}
              >
                {deletingId === item.id ? "…" : "Dismiss"}
              </Button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
