import type { InputHTMLAttributes } from "react";
import { cn } from "./lib/cn.js";

export type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export function Input({ className, invalid, ...rest }: InputProps) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border bg-[var(--tc-surface)] px-3 text-sm text-[var(--tc-fg)]",
        "placeholder:text-[var(--tc-muted)]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        invalid ? "border-[var(--tc-danger)]" : "border-[var(--tc-border)]",
        className,
      )}
      {...rest}
    />
  );
}
