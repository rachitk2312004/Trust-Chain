import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { GovernanceRisk } from "../../services/governanceApi";

export function RiskRegisterTable({ risks }: { risks: GovernanceRisk[] }) {
  if (risks.length === 0) {
    return <FormHint>No risks in the register yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Risk</TH>
          <TH>Category</TH>
          <TH>Inherent</TH>
          <TH>Residual</TH>
          <TH>Band</TH>
          <TH>Status</TH>
        </TR>
      </THead>
      <TBody>
        {risks.map((r) => (
          <TR key={r.id}>
            <TD>
              <div className="font-medium">{r.title}</div>
              <div className="font-mono text-xs text-[var(--tc-muted)]">{r.key}</div>
            </TD>
            <TD className="text-xs">{r.category}</TD>
            <TD className="font-mono text-xs">{r.inherentScore}</TD>
            <TD className="font-mono text-xs">
              {r.residualScore} ({r.residualLikelihood}×{r.residualImpact})
            </TD>
            <TD>
              <Badge
                tone={
                  r.band === "critical" || r.band === "high"
                    ? "danger"
                    : r.band === "medium"
                      ? "neutral"
                      : "success"
                }
              >
                {r.band}
              </Badge>
            </TD>
            <TD>
              <Badge tone={r.status === "closed" || r.status === "accepted" ? "success" : "neutral"}>
                {r.status}
              </Badge>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
