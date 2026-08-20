import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type {
  ReputationHistoryEvent,
  ReputationTrend,
} from "../../services/reputationApi";

export function ReputationHistoryPanel({
  events,
  trend,
}: {
  events: ReputationHistoryEvent[];
  trend: ReputationTrend;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[var(--tc-muted)]">Trend</span>
        <Badge
          tone={
            trend.direction === "up"
              ? "success"
              : trend.direction === "down"
                ? "danger"
                : "neutral"
          }
        >
          {trend.direction} ({trend.delta >= 0 ? "+" : ""}
          {trend.delta.toFixed(3)})
        </Badge>
        <span className="font-mono text-xs text-[var(--tc-muted)]">
          avg {trend.average.toFixed(3)}
        </span>
      </div>

      {events.length === 0 ? (
        <FormHint>No history events yet.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Subject</TH>
              <TH>Overall</TH>
              <TH>Trust</TH>
              <TH>Fraud</TH>
              <TH>Reason</TH>
            </TR>
          </THead>
          <TBody>
            {events.map((e) => (
              <TR key={e.id}>
                <TD className="text-xs text-[var(--tc-muted)]">
                  {new Date(e.createdAt).toLocaleString()}
                </TD>
                <TD>
                  <div className="text-sm">{e.label ?? e.subjectId}</div>
                  <div className="font-mono text-xs text-[var(--tc-muted)]">{e.subjectType}</div>
                </TD>
                <TD className="font-mono text-xs">{e.overallScore.toFixed(3)}</TD>
                <TD className="font-mono text-xs">{e.trustScore.toFixed(3)}</TD>
                <TD className="font-mono text-xs">{e.fraudScore.toFixed(3)}</TD>
                <TD className="text-xs">{e.reason}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
