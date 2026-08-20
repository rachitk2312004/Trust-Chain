import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap items-end justify-between gap-3", className)}>
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight text-tc-fg">{title}</h2>
        {description ? <p className="mt-1 text-sm text-tc-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}
