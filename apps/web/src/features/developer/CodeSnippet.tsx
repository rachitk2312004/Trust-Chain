import { useMemo, useState } from "react";

const LANGS = ["typescript", "javascript", "python", "curl"] as const;

export function CodeSnippet({
  title,
  snippets,
}: {
  title?: string;
  snippets: Partial<Record<(typeof LANGS)[number], string>>;
}) {
  const available = useMemo(
    () => LANGS.filter((lang) => Boolean(snippets[lang])),
    [snippets],
  );
  const [lang, setLang] = useState<(typeof LANGS)[number]>(available[0] ?? "typescript");
  const code = snippets[lang] ?? "";

  return (
    <div className="space-y-2">
      {title ? <div className="text-sm font-medium">{title}</div> : null}
      <div className="flex flex-wrap gap-2">
        {available.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setLang(option)}
            className={`rounded border px-2.5 py-1 text-xs ${
              lang === option
                ? "border-[var(--tc-accent)] text-[var(--tc-accent)]"
                : "border-[var(--tc-border)] text-[var(--tc-muted)]"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
      <pre className="overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
        {code}
      </pre>
    </div>
  );
}
