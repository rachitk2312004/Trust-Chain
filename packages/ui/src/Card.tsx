import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/cn.js";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

export function Card({ className, children, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[var(--tc-border)] bg-[var(--tc-surface)] p-5 shadow-[var(--tc-shadow-sm)]",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...rest }: CardProps) {
  return (
    <div className={cn("mb-3 flex flex-col gap-1", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...rest }: CardProps) {
  return (
    <h3 className={cn("text-base font-semibold text-[var(--tc-fg)]", className)} {...rest}>
      {children}
    </h3>
  );
}

export function CardDescription({ className, children, ...rest }: CardProps) {
  return (
    <p className={cn("text-sm text-[var(--tc-muted)]", className)} {...rest}>
      {children}
    </p>
  );
}
