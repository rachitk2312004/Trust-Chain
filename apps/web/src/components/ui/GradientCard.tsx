import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { Card } from "./Card";

export function GradientCard({
  title,
  description,
  children,
  action,
  className,
  variant = "emerald",
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  variant?: "emerald" | "blue" | "purple" | "slate";
}) {
  const gradients = {
    emerald: "from-emerald-600 via-emerald-700 to-slate-900",
    blue: "from-blue-600 via-blue-700 to-slate-900",
    purple: "from-violet-600 via-indigo-700 to-slate-900",
    slate: "from-slate-700 via-slate-800 to-slate-950",
  };

  return (
    <Card
      glass
      className={cn(
        "relative overflow-hidden border-0 bg-gradient-to-br text-white shadow-elevated",
        gradients[variant],
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 tc-grid-bg" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight">{title}</h3>
            {description ? <p className="mt-2 max-w-xl text-sm text-white/75">{description}</p> : null}
          </div>
          {action}
        </div>
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </Card>
  );
}
