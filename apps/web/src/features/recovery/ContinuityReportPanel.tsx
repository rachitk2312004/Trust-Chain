import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { ContinuityReport } from "../../services/recoveryApi";

export function ContinuityReportPanel({
  reports,
  latest,
}: {
  reports: ContinuityReport[];
  latest?: ContinuityReport | null;
}) {
  if (reports.length === 0 && !latest) {
    return <FormHint>No continuity reports yet.</FormHint>;
  }

  const rows = reports.length > 0 ? reports : latest ? [latest] : [];

  return (
    <div className="space-y-4">
      {latest ? (
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
            Latest snapshot
          </div>
          <div className="mt-1 flex items-center gap-3">
            <span className="text-3xl font-semibold">{Math.round(latest.score * 100)}%</span>
            <Badge tone={latest.score >= 0.8 ? "success" : "neutral"}>continuity</Badge>
          </div>
          <p className="mt-2 text-xs text-[var(--tc-muted)]">
            {new Date(latest.createdAt).toLocaleString()}
          </p>
        </div>
      ) : null}

      <Table>
        <THead>
          <TR>
            <TH>Score</TH>
            <TH>Created</TH>
            <TH>ID</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => (
            <TR key={r.id}>
              <TD>
                <Badge tone={r.score >= 0.8 ? "success" : r.score >= 0.5 ? "neutral" : "danger"}>
                  {Math.round(r.score * 100)}%
                </Badge>
              </TD>
              <TD className="text-xs">{new Date(r.createdAt).toLocaleString()}</TD>
              <TD className="font-mono text-xs">{r.id.slice(0, 8)}…</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
