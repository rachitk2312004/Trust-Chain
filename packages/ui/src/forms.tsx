import type { LabelHTMLAttributes, ReactNode, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "./lib/cn.js";

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("mb-1 block text-sm font-medium text-[var(--tc-fg)]", className)}
      {...rest}
    />
  );
}

export function Field({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-1", className)}>{children}</div>;
}

export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-[var(--tc-danger)]">{children}</p>;
}

export function FormHint({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <p className="text-xs text-[var(--tc-muted)]">{children}</p>;
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-md border bg-[var(--tc-surface)] px-3 py-2 text-sm text-[var(--tc-fg)]",
        "placeholder:text-[var(--tc-muted)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)]",
        invalid ? "border-[var(--tc-danger)]" : "border-[var(--tc-border)]",
        className,
      )}
      {...rest}
    />
  );
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border bg-[var(--tc-surface)] px-3 text-sm text-[var(--tc-fg)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)]",
        invalid ? "border-[var(--tc-danger)]" : "border-[var(--tc-border)]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  );
}
