import { Loader2 } from "lucide-react";
import { cn } from "../../lib/cn";

export function LoadingScreen({
  label = "Loading TrustChain…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[40vh] flex-col items-center justify-center gap-4", className)}>
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-2xl bg-emerald-500/20" />
        <Loader2 className="relative h-7 w-7 animate-spin text-tc-accent" />
      </div>
      <p className="text-sm font-medium text-tc-muted">{label}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-tc-surface-2", className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/5" />
    </div>
  );
}
