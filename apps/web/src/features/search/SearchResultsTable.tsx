import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import { Link } from "react-router-dom";

export type SearchResultRow = {
  entityType: string;
  entityId: string;
  organizationId: string | null;
  title: string;
  subtitle: string | null;
  status: string | null;
  createdAt: string;
  score: number;
  matchKind: string;
};

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

export function SearchResultsTable({ results }: { results: SearchResultRow[] }) {
  if (results.length === 0) {
    return <FormHint>No results match this query.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Title</TH>
          <TH>Type</TH>
          <TH>Status</TH>
          <TH>Match</TH>
          <TH>Score</TH>
          <TH>When</TH>
        </TR>
      </THead>
      <TBody>
        {results.map((row) => {
          const href = hrefFor(row);
          return (
            <TR key={`${row.entityType}:${row.entityId}`}>
              <TD>
                {href ? (
                  <Link to={href} className="text-[var(--tc-accent)] hover:underline">
                    {row.title}
                  </Link>
                ) : (
                  row.title
                )}
                {row.subtitle ? (
                  <div className="text-xs text-[var(--tc-muted)]">{row.subtitle}</div>
                ) : null}
              </TD>
              <TD className="font-mono text-xs">{row.entityType}</TD>
              <TD>{row.status ? <Badge tone="neutral">{row.status}</Badge> : "—"}</TD>
              <TD className="text-xs text-[var(--tc-muted)]">{row.matchKind}</TD>
              <TD className="text-xs">{row.score}</TD>
              <TD className="text-xs text-[var(--tc-muted)]">
                {new Date(row.createdAt).toLocaleString()}
              </TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}
