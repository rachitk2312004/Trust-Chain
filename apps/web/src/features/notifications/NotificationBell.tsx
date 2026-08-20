import { Button } from "@trustchain/ui";
import { useUnreadCounter } from "./hooks";

function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5" />
      <path d="M9.5 17a2.5 2.5 0 0 0 5 0" />
    </svg>
  );
}

export function NotificationBell({
  open,
  onToggle,
  live = false,
}: {
  open: boolean;
  onToggle: () => void;
  /** When true, badge updates come from the live SSE cache. */
  live?: boolean;
}) {
  const unread = useUnreadCounter();
  const count = unread.count;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-live={live ? "polite" : undefined}
      onClick={onToggle}
      className="relative px-2"
      data-live={live ? "true" : "false"}
    >
      <BellIcon />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-[var(--tc-accent)] px-1 text-[10px] font-semibold text-[var(--tc-accent-fg)]">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Button>
  );
}
