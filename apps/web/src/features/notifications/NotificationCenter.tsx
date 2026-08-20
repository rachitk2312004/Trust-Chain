import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError, FormHint } from "@trustchain/ui";
import { useFeedback } from "../../hooks/useFeedback";
import { getNotificationErrorMessage } from "../../lib/notificationErrors";
import { NotificationBell } from "./NotificationBell";
import { NotificationFilters } from "./NotificationFilters";
import { NotificationList } from "./NotificationList";
import {
  useDeleteNotification,
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
} from "./hooks";
import { useNotificationStream } from "./useNotificationStream";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [eventType, setEventType] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const feedback = useFeedback();
  const { isLive } = useNotificationStream(open);

  const list = useNotifications(
    {
      unreadOnly: unreadOnly || undefined,
      eventType: eventType || undefined,
      limit: 20,
      offset: 0,
    },
    open,
  );
  const markRead = useMarkAsRead();
  const markAll = useMarkAllAsRead();
  const remove = useDeleteNotification();

  const filtered = useMemo(() => {
    const rows = list.data?.notifications ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [list.data, query]);

  return (
    <div className="relative">
      <NotificationBell open={open} onToggle={() => setOpen((v) => !v)} live={isLive} />
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Notification center"
            className="absolute right-0 z-50 mt-2 w-[min(28rem,calc(100vw-2rem))] rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-[var(--tc-border)] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[var(--tc-fg)]">Notifications</p>
                <p className="text-xs text-[var(--tc-muted)]">
                  {list.data?.unreadCount ?? 0} unread
                  {isLive ? " · live" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={markAll.isPending || (list.data?.unreadCount ?? 0) === 0}
                  onClick={() =>
                    markAll.mutate(undefined, {
                      onSuccess: () => feedback.success("All notifications marked read"),
                      onError: (err) => feedback.error(err, "Could not mark all read"),
                    })
                  }
                >
                  Mark all read
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
            <div className="space-y-3 px-4 py-3">
              <NotificationFilters
                eventType={eventType}
                unreadOnly={unreadOnly}
                query={query}
                onEventTypeChange={setEventType}
                onUnreadOnlyChange={setUnreadOnly}
                onQueryChange={setQuery}
              />
              {list.isError ? (
                <FormError>{getNotificationErrorMessage(list.error)}</FormError>
              ) : null}
              {list.isLoading ? (
                <FormHint>Loading notifications…</FormHint>
              ) : (
                <div className="max-h-80 overflow-y-auto">
                  <NotificationList
                    items={filtered}
                    highlightId={filtered[0]?.unread ? filtered[0].id : null}
                    markingId={markRead.isPending ? markRead.variables ?? null : null}
                    deletingId={remove.isPending ? remove.variables ?? null : null}
                    onMarkRead={(id) =>
                      markRead.mutate(id, {
                        onError: (err) => feedback.error(err, "Could not mark as read"),
                      })
                    }
                    onDelete={(id) =>
                      remove.mutate(id, {
                        onSuccess: () => feedback.info("Notification dismissed"),
                        onError: (err) => feedback.error(err, "Could not dismiss"),
                      })
                    }
                  />
                </div>
              )}
            </div>
            <div className="flex justify-between border-t border-[var(--tc-border)] px-4 py-2 text-sm">
              <Link
                to="/notifications"
                className="text-[var(--tc-accent)] hover:underline"
                onClick={() => setOpen(false)}
              >
                Open inbox
              </Link>
              <Link
                to="/notifications/preferences"
                className="text-[var(--tc-muted)] hover:text-[var(--tc-fg)]"
                onClick={() => setOpen(false)}
              >
                Preferences
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
