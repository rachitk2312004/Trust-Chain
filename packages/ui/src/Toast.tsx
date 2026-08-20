import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "./lib/cn.js";

export type ToastTone = "info" | "success" | "warning" | "danger";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastContextValue = {
  push: (toast: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEDUPE_MS = 2500;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const recentKeysRef = useRef(new Map<string, number>());

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (toast: Omit<ToastItem, "id">) => {
      const key = `${toast.tone ?? "info"}::${toast.title}::${toast.description ?? ""}`;
      const now = Date.now();
      const last = recentKeysRef.current.get(key);
      if (last !== undefined && now - last < DEDUPE_MS) {
        return;
      }
      recentKeysRef.current.set(key, now);

      const id = `toast-${now}-${Math.random().toString(16).slice(2, 8)}`;
      setItems((prev) => [...prev, { ...toast, id }].slice(-MAX_VISIBLE));
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {items.map((item) => (
          <Toast key={item.id} item={item} onDismiss={() => dismiss(item.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const tone = item.tone ?? "info";
  return (
    <div
      className={cn(
        "pointer-events-auto rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 shadow-lg",
        tone === "danger" && "border-red-300",
        tone === "success" && "border-emerald-300",
        tone === "warning" && "border-amber-300",
      )}
      role="status"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-[var(--tc-fg)]">{item.title}</p>
          {item.description ? (
            <p className="mt-1 text-xs text-[var(--tc-muted)]">{item.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="text-xs text-[var(--tc-muted)] hover:text-[var(--tc-fg)]"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
