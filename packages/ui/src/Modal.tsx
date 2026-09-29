import type { ReactNode } from "react";
import { useEffect } from "react";
import { cn } from "./lib/cn.js";
import { Button } from "./Button.js";

export type ModalProps = {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  className?: string;
};

export function Modal({ open, title, children, onClose, footer, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog backdrop"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          // Default width is max-w-lg; callers override with max-w-* in className.
          // Avoid shipping both max-w-lg and max-w-5xl (cn does not dedupe Tailwind conflicts).
          "relative z-10 flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] shadow-lg",
          className?.includes("max-w-") ? className : cn("max-w-lg", className),
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--tc-border)] px-5 py-3 sm:px-6">
          <h2 className="text-base font-semibold text-[var(--tc-fg)]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 text-sm text-[var(--tc-fg)] sm:px-6">
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--tc-border)] bg-[var(--tc-surface)] px-5 py-3 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
