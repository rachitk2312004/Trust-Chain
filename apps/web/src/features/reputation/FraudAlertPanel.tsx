import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { ReputationAlert } from "../../services/reputationApi";

export function FraudAlertPanel({
  alerts,
  openCount,
  criticalCount,
}: {
  alerts: ReputationAlert[];
  openCount: number;
  criticalCount: number;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-sm">
        <span>
          Open <span className="font-mono font-medium">{openCount}</span>
        </span>
        <span>
          Critical <span className="font-mono font-medium">{criticalCount}</span>
        </span>
      </div>

      {alerts.length === 0 ? (
        <FormHint>No fraud or anomaly alerts.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Alert</TH>
              <TH>Subject</TH>
              <TH>Severity</TH>
              <TH>Status</TH>
              <TH>Score</TH>
            </TR>
          </THead>
          <TBody>
            {alerts.map((a) => (
              <TR key={a.id}>
                <TD>
                  <div className="font-medium">{a.title}</div>
                  <div className="text-xs text-[var(--tc-muted)]">{a.detail}</div>
                </TD>
                <TD>
                  <div className="text-sm">{a.label ?? a.subjectId ?? "—"}</div>
                  <div className="font-mono text-xs text-[var(--tc-muted)]">
                    {a.subjectType ?? "—"}
                  </div>
                </TD>
                <TD>
                  <Badge
                    tone={
                      a.severity === "critical" || a.severity === "high"
                        ? "danger"
                        : a.severity === "medium"
                          ? "neutral"
                          : "success"
                    }
                  >
                    {a.severity}
                  </Badge>
                </TD>
                <TD>
                  <Badge tone={a.status === "open" ? "danger" : "neutral"}>{a.status}</Badge>
                </TD>
                <TD className="font-mono text-xs">
                  {a.scoreSnapshot != null ? a.scoreSnapshot.toFixed(3) : "—"}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
