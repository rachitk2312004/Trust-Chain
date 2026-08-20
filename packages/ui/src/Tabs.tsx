import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { cn } from "./lib/cn.js";

type TabsContextValue = {
  value: string;
  setValue: (next: string) => void;
};

const TabsContext = createContext<TabsContextValue | null>(null);

export type TabsProps = {
  defaultValue: string;
  children: ReactNode;
  className?: string;
  onValueChange?: (value: string) => void;
};

export function Tabs({ defaultValue, children, className, onValueChange }: TabsProps) {
  const [value, setValueState] = useState(defaultValue);
  const setValue = useCallback(
    (next: string) => {
      setValueState(next);
      onValueChange?.(next);
    },
    [onValueChange],
  );
  const ctx = useMemo(() => ({ value, setValue }), [value, setValue]);
  return (
    <TabsContext.Provider value={ctx}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex gap-1 rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface-2)] p-1",
        className,
      )}
      role="tablist"
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger requires Tabs");
  const active = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "rounded px-3 py-1.5 text-sm font-medium",
        active
          ? "bg-[var(--tc-surface)] text-[var(--tc-fg)] shadow-sm"
          : "text-[var(--tc-muted)] hover:text-[var(--tc-fg)]",
      )}
      onClick={() => ctx.setValue(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent requires Tabs");
  if (ctx.value !== value) return null;
  return <div className={cn("mt-4", className)}>{children}</div>;
}
