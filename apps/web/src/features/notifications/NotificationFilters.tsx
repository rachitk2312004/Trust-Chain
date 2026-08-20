import { Input, Select } from "@trustchain/ui";
import { NotificationEventTypeList } from "@trustchain/config";

const EVENT_LABELS: Record<string, string> = {
  invitation_created: "Invitation created",
  invitation_accepted: "Invitation accepted",
  member_added: "Member added",
  document_uploaded: "Document uploaded",
  document_verified: "Document verified",
  document_archived: "Document archived",
  document_restored: "Document restored",
  share_created: "Share created",
  qr_created: "QR created",
  qr_revoked: "QR revoked",
  verification_completed: "Verification completed",
};

export function eventLabel(eventType: string): string {
  return EVENT_LABELS[eventType] ?? eventType.replaceAll("_", " ");
}

export function NotificationFilters({
  eventType,
  unreadOnly,
  query,
  onEventTypeChange,
  onUnreadOnlyChange,
  onQueryChange,
  showUnreadFilter = true,
}: {
  eventType: string;
  unreadOnly: boolean;
  query: string;
  onEventTypeChange: (value: string) => void;
  onUnreadOnlyChange: (value: boolean) => void;
  onQueryChange: (value: string) => void;
  showUnreadFilter?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-[12rem] flex-1">
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search title or body…"
          aria-label="Search notifications"
        />
      </div>
      <Select
        className="w-52"
        value={eventType}
        onChange={(e) => onEventTypeChange(e.target.value)}
        aria-label="Filter by event type"
      >
        <option value="">All events</option>
        {NotificationEventTypeList.map((type) => (
          <option key={type} value={type}>
            {eventLabel(type)}
          </option>
        ))}
      </Select>
      {showUnreadFilter ? (
        <Select
          className="w-40"
          value={unreadOnly ? "unread" : "all"}
          onChange={(e) => onUnreadOnlyChange(e.target.value === "unread")}
          aria-label="Filter by read state"
        >
          <option value="all">All</option>
          <option value="unread">Unread only</option>
        </Select>
      ) : null}
    </div>
  );
}
