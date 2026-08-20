import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import { NotificationFilters } from "../features/notifications/NotificationFilters";
import { NotificationList } from "../features/notifications/NotificationList";
import {
  useDeleteNotification,
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
} from "../features/notifications/hooks";
import { useFeedback } from "../hooks/useFeedback";
import { usePermissions } from "../hooks/usePermissions";
import { getNotificationErrorMessage } from "../lib/notificationErrors";

export function NotificationsPage() {
  const feedback = useFeedback();
  const { isOpsAdmin } = usePermissions();
  const [eventType, setEventType] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 30;

  const list = useNotifications({
    unreadOnly: unreadOnly || undefined,
    eventType: eventType || undefined,
    limit,
    offset,
  });
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
    <>
      <PageHeader
        title="Notifications"
        description="In-app inbox, email delivery status, and event subscriptions."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
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
            <Link
              to="/notifications/preferences"
              className="inline-flex h-10 items-center text-sm text-[var(--tc-accent)] hover:underline"
            >
              Preferences
            </Link>
            <Link
              to="/notifications/history"
              className="inline-flex h-10 items-center text-sm text-[var(--tc-accent)] hover:underline"
            >
              History
            </Link>
            {isOpsAdmin ? (
              <Link
                to="/notifications/ops"
                className="inline-flex h-10 items-center text-sm text-[var(--tc-accent)] hover:underline"
              >
                Ops
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="mb-4">
        <NotificationFilters
          eventType={eventType}
          unreadOnly={unreadOnly}
          query={query}
          onEventTypeChange={(v) => {
            setOffset(0);
            setEventType(v);
          }}
          onUnreadOnlyChange={(v) => {
            setOffset(0);
            setUnreadOnly(v);
          }}
          onQueryChange={setQuery}
        />
      </div>

      {list.isError ? <FormError>{getNotificationErrorMessage(list.error)}</FormError> : null}
      {list.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading notifications…</p>
      ) : (
        <NotificationList
          items={filtered}
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
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={offset === 0 || list.isFetching}
          onClick={() => setOffset((v) => Math.max(0, v - limit))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={(list.data?.notifications.length ?? 0) < limit || list.isFetching}
          onClick={() => setOffset((v) => v + limit)}
        >
          Next
        </Button>
        <span className="text-xs text-[var(--tc-muted)]">
          {list.data?.unreadCount ?? 0} unread · total {list.data?.total ?? 0}
        </span>
      </div>
    </>
  );
}
