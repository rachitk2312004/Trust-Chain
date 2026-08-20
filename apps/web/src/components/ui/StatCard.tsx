import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "../../lib/cn";
import { Card } from "./Card";

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  trendLabel,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "flat";
  trendLabel?: string;
  tone?: "default" | "success" | "warning" | "error" | "info";
}) {
  const toneRing =
    tone === "success"
      ? "from-emerald-500/15 to-transparent"
      : tone === "warning"
        ? "from-amber-500/15 to-transparent"
        : tone === "error"
          ? "from-rose-500/15 to-transparent"
          : tone === "info"
            ? "from-blue-500/15 to-transparent"
            : "from-emerald-500/10 to-transparent";

  return (
    <Card className={cn("relative overflow-hidden bg-gradient-to-br", toneRing)} hover>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-tc-muted">{label}</p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-tc-fg">{value}</p>
          {hint ? <p className="mt-2 text-xs text-tc-muted">{hint}</p> : null}
          {trend && trendLabel ? (
            <p
              className={cn(
                "mt-3 inline-flex items-center gap-1 text-xs font-medium",
                trend === "up" && "text-tc-success",
                trend === "down" && "text-tc-error",
                trend === "flat" && "text-tc-muted",
              )}
            >
              {trend === "up" ? <TrendingUp className="h-3.5 w-3.5" /> : null}
              {trend === "down" ? <TrendingDown className="h-3.5 w-3.5" /> : null}
              {trendLabel}
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-tc-accent-soft text-tc-accent">
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
