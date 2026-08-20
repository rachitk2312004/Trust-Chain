import type { ReactNode } from "react";
import { cn } from "./lib/cn.js";

export type NavbarProps = {
  brand?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function Navbar({ brand, actions, className }: NavbarProps) {
  return (
    <header
      className={cn(
        "flex h-14 items-center justify-between border-b border-[var(--tc-border)] bg-[var(--tc-surface)] px-4",
        className,
      )}
    >
      <div className="text-sm font-semibold text-[var(--tc-fg)]">{brand}</div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}
