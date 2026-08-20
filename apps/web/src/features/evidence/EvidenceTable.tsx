import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import { Link } from "react-router-dom";

export type EvidenceRow = {
  id: string;
  publicCode: string;
  title: string;
  status: string;
  currentVersion: number;
  frameworks: string[];
  tags: string[];
  checksumSha256: string;
  createdAt: string;
};

export function EvidenceTable({ evidence }: { evidence: EvidenceRow[] }) {
  if (evidence.length === 0) {
    return <FormHint>No evidence collected yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Title</TH>
          <TH>Code</TH>
          <TH>Status</TH>
          <TH>Version</TH>
          <TH>Frameworks</TH>
          <TH>Created</TH>
        </TR>
      </THead>
      <TBody>
        {evidence.map((row) => (
          <TR key={row.id}>
            <TD>
              <Link
                to={`/evidence/${row.id}`}
                className="text-[var(--tc-accent)] hover:underline"
              >
                {row.title}
              </Link>
              {row.tags.length ? (
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.tags.slice(0, 4).map((tag) => (
                    <Badge key={tag} tone="neutral">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </TD>
            <TD className="font-mono text-xs">{row.publicCode}</TD>
            <TD>
              <Badge
                tone={
                  row.status === "validated"
                    ? "success"
                    : row.status === "rejected"
                      ? "danger"
                      : "neutral"
                }
              >
                {row.status}
              </Badge>
            </TD>
            <TD className="text-xs">v{row.currentVersion}</TD>
            <TD className="font-mono text-xs">{row.frameworks.join(", ") || "—"}</TD>
            <TD className="text-xs text-[var(--tc-muted)]">
              {new Date(row.createdAt).toLocaleString()}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
