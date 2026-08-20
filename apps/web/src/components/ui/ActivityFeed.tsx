import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ActivityItem = {
  id: string;
  title: string;
  description?: string;
  time: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "error" | "info";
};

const toneDot: Record<NonNullable<ActivityItem["tone"]>, string> = {
  default: "bg-tc-muted",
  success: "bg-tc-success",
  warning: "bg-tc-warning",
  error: "bg-tc-error",
  info: "bg-tc-info",
};

export function ActivityFeed({
  items,
  className,
  empty,
}: {
  items: ActivityItem[];
  className?: string;
  empty?: ReactNode;
}) {
  if (items.length === 0) return <>{empty}</>;

  return (
    <ul className={cn("space-y-1", className)}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-tc-surface-2/70"
        >
          <div className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-tc-surface-2 text-tc-muted">
            {item.icon ?? <span className={cn("h-2 w-2 rounded-full", toneDot[item.tone ?? "default"])} />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <p className="truncate text-sm font-medium text-tc-fg">{item.title}</p>
              <time className="shrink-0 text-xs text-tc-muted">{item.time}</time>
            </div>
            {item.description ? (
              <p className="mt-0.5 truncate text-sm text-tc-muted">{item.description}</p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
