import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TimelineItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  icon?: ReactNode;
};

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("relative space-y-6 border-l border-tc-border pl-6", className)}>
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[1.55rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-tc-border bg-tc-surface text-tc-accent shadow-soft">
            {item.icon ?? <span className="h-2 w-2 rounded-full bg-tc-accent" />}
          </span>
          <p className="text-sm font-semibold text-tc-fg">{item.title}</p>
          {item.description ? <p className="mt-1 text-sm text-tc-muted">{item.description}</p> : null}
          {item.meta ? <p className="mt-1 text-xs text-tc-muted">{item.meta}</p> : null}
        </li>
      ))}
    </ol>
  );
}
