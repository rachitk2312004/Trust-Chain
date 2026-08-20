import { FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { LeaderboardEntry } from "../../services/reputationApi";

export function LeaderboardCard({
  entries,
  title = "Leaderboard",
}: {
  entries: LeaderboardEntry[];
  title?: string;
}) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
        {title}
      </h3>
      {entries.length === 0 ? (
        <FormHint>No ranked subjects yet.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Rank</TH>
              <TH>Subject</TH>
              <TH>Type</TH>
              <TH>Overall</TH>
              <TH>Trust</TH>
            </TR>
          </THead>
          <TBody>
            {entries.map((e) => (
              <TR key={e.id}>
                <TD className="font-mono text-xs">#{e.rank}</TD>
                <TD>
                  <div className="font-medium">{e.label ?? e.subjectId}</div>
                  <div className="font-mono text-xs text-[var(--tc-muted)]">{e.subjectId}</div>
                </TD>
                <TD className="font-mono text-xs">{e.subjectType}</TD>
                <TD className="font-mono text-xs font-medium">{e.overallScore.toFixed(3)}</TD>
                <TD className="font-mono text-xs">{e.trustScore.toFixed(3)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
