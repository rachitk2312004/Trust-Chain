import { Search } from "lucide-react";
import { cn } from "../../lib/cn";

export function SearchBar({
  value,
  onChange,
  placeholder = "Search…",
  className,
  onSubmit,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onSubmit?: () => void;
}) {
  return (
    <form
      className={cn(
        "relative flex items-center rounded-xl border border-tc-border bg-tc-surface shadow-soft",
        className,
      )}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-tc-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tc-focus w-full rounded-xl bg-transparent py-2.5 pl-10 pr-3 text-sm text-tc-fg placeholder:text-tc-muted"
      />
    </form>
  );
}
