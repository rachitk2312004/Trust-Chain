import { Badge } from "@trustchain/ui";
import { Link } from "react-router-dom";
import type { SearchResultRow } from "./SearchResultsTable";

function hrefFor(row: SearchResultRow): string | null {
  switch (row.entityType) {
    case "document":
      return `/documents/${row.entityId}`;
    case "certificate":
      return `/certificates/${row.entityId}`;
    case "signature":
      return `/signatures/${row.entityId}`;
    case "organization":
      return `/organizations/${row.entityId}`;
    default:
      return null;
  }
}

export function SearchResultCard({ result }: { result: SearchResultRow }) {
  const href = hrefFor(result);
  const title = href ? (
    <Link to={href} className="font-medium text-[var(--tc-accent)] hover:underline">
      {result.title}
    </Link>
  ) : (
    <span className="font-medium">{result.title}</span>
  );

  return (
    <article className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{result.entityType}</Badge>
        {result.status ? <Badge tone="neutral">{result.status}</Badge> : null}
        <span className="text-xs text-[var(--tc-muted)]">
          {result.matchKind} · score {result.score}
        </span>
      </div>
      <div>{title}</div>
      {result.subtitle ? (
        <p className="mt-1 text-sm text-[var(--tc-muted)]">{result.subtitle}</p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--tc-muted)]">
        {new Date(result.createdAt).toLocaleString()}
      </p>
    </article>
  );
}
