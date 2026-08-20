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
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
          "relative z-10 w-full max-w-lg rounded-lg border border-[var(--tc-border)] bg-[var(--tc-surface)] shadow-lg",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-[var(--tc-border)] px-5 py-3">
          <h2 className="text-base font-semibold text-[var(--tc-fg)]">{title}</h2>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            Close
          </Button>
        </div>
        <div className="px-5 py-4 text-sm text-[var(--tc-fg)]">{children}</div>
        {footer ? (
          <div className="flex justify-end gap-2 border-t border-[var(--tc-border)] px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
