import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "./lib/cn.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
};

const variantClass: Record<ButtonVariant, string> = {
  primary: "bg-[var(--tc-accent)] text-[var(--tc-accent-fg)] hover:opacity-90",
  secondary:
    "bg-[var(--tc-surface-2)] text-[var(--tc-fg)] border border-[var(--tc-border)] hover:bg-[var(--tc-surface-3)]",
  ghost: "bg-transparent text-[var(--tc-fg)] hover:bg-[var(--tc-surface-2)]",
  danger: "bg-[var(--tc-danger)] text-white hover:opacity-90",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--tc-accent)]",
        "disabled:pointer-events-none disabled:opacity-50",
        variantClass[variant],
        sizeClass[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
