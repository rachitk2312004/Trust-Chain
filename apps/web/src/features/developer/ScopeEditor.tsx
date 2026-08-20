const DEFAULT_SCOPES = ["read", "write", "webhooks", "keys"] as const;

export function ScopeEditor({
  scopes,
  onChange,
  options = DEFAULT_SCOPES,
}: {
  scopes: string[];
  onChange: (scopes: string[]) => void;
  options?: readonly string[];
}) {
  const toggle = (scope: string) => {
    onChange(
      scopes.includes(scope) ? scopes.filter((s) => s !== scope) : [...scopes, scope],
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((scope) => {
        const active = scopes.includes(scope);
        return (
          <button
            key={scope}
            type="button"
            onClick={() => toggle(scope)}
            className={`rounded border px-3 py-1.5 text-sm ${
              active
                ? "border-[var(--tc-accent)] bg-[var(--tc-accent)]/10 text-[var(--tc-accent)]"
                : "border-[var(--tc-border)] text-[var(--tc-muted)]"
            }`}
          >
            {scope}
          </button>
        );
      })}
    </div>
  );
}
