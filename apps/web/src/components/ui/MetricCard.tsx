import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card } from "./Card";

export function MetricCard({
  title,
  value,
  subtitle,
  children,
  className,
}: {
  title: string;
  value?: ReactNode;
  subtitle?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("min-h-[180px]", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-tc-muted">{title}</p>
          {value != null ? (
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-tc-fg">{value}</p>
          ) : null}
          {subtitle ? <p className="mt-1 text-xs text-tc-muted">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}
