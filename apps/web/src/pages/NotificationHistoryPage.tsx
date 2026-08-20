import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, FormError } from "@trustchain/ui";
import { PageHeader } from "../components/PageHeader";
import {
  NotificationFilters,
  NotificationList,
  useNotificationHistory,
} from "../features/notifications";
import { AppShellLayout } from "../layouts/AppShellLayout";
import { getNotificationErrorMessage } from "../lib/notificationErrors";

export function NotificationHistoryPage() {
  const [eventType, setEventType] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const history = useNotificationHistory({
    eventType: eventType || undefined,
    limit,
    offset,
  });

  const filtered = useMemo(() => {
    const rows = history.data?.notifications ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
    );
  }, [history.data, query]);

  return (
    <AppShellLayout>
      <PageHeader
        title="Notification history"
        description="Read and unread notifications across supported event types."
        actions={
          <Link to="/notifications" className="text-sm text-[var(--tc-accent)] hover:underline">
            Inbox
          </Link>
        }
      />

      <div className="mb-4">
        <NotificationFilters
          eventType={eventType}
          unreadOnly={false}
          query={query}
          showUnreadFilter={false}
          onEventTypeChange={(v) => {
            setOffset(0);
            setEventType(v);
          }}
          onUnreadOnlyChange={() => undefined}
          onQueryChange={setQuery}
        />
      </div>

      {history.isError ? (
        <FormError>{getNotificationErrorMessage(history.error)}</FormError>
      ) : null}
      {history.isLoading ? (
        <p className="text-sm text-[var(--tc-muted)]">Loading history…</p>
      ) : (
        <NotificationList items={filtered} emptyMessage="No notification history yet." />
      )}

      <div className="mt-4 flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={offset === 0 || history.isFetching}
          onClick={() => setOffset((v) => Math.max(0, v - limit))}
        >
          Previous
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={(history.data?.notifications.length ?? 0) < limit || history.isFetching}
          onClick={() => setOffset((v) => v + limit)}
        >
          Next
        </Button>
        <span className="text-xs text-[var(--tc-muted)]">Total {history.data?.total ?? 0}</span>
      </div>
    </AppShellLayout>
  );
}
