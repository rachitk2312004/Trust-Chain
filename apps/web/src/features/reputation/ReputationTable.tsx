import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { ReputationProfile } from "../../services/reputationApi";

export function ReputationTable({
  profiles,
  onWatch,
  watchingId,
}: {
  profiles: ReputationProfile[];
  onWatch?: (id: string) => void;
  watchingId?: string | null;
}) {
  if (profiles.length === 0) {
    return <FormHint>No reputation profiles yet. Score a subject to begin.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Subject</TH>
          <TH>Type</TH>
          <TH>Trust</TH>
          <TH>Contribution</TH>
          <TH>Fraud</TH>
          <TH>Overall</TH>
          <TH>Status</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {profiles.map((p) => (
          <TR key={p.id}>
            <TD>
              <div className="font-medium">{p.label ?? p.subjectId}</div>
              <div className="font-mono text-xs text-[var(--tc-muted)]">{p.subjectId}</div>
            </TD>
            <TD className="font-mono text-xs">{p.subjectType}</TD>
            <TD className="font-mono text-xs">{p.trustScore.toFixed(3)}</TD>
            <TD className="font-mono text-xs">{p.contributionScore.toFixed(3)}</TD>
            <TD className="font-mono text-xs">{p.fraudScore.toFixed(3)}</TD>
            <TD className="font-mono text-xs font-medium">{p.overallScore.toFixed(3)}</TD>
            <TD>
              <Badge
                tone={
                  p.status === "flagged" || p.status === "suspended"
                    ? "danger"
                    : p.status === "watched"
                      ? "neutral"
                      : "success"
                }
              >
                {p.status}
              </Badge>
            </TD>
            <TD>
              {onWatch && p.status === "active" ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={watchingId === p.id}
                  onClick={() => onWatch(p.id)}
                >
                  Watch
                </Button>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
