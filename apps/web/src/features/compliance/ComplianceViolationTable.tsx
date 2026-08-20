import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";

export type ComplianceViolationRow = {
  id: string;
  framework: string;
  ruleKey: string;
  title: string;
  severity: string;
  status: string;
  detectedAt: string;
};

function severityTone(severity: string) {
  if (severity === "critical" || severity === "high") return "danger" as const;
  if (severity === "medium") return "warning" as const;
  return "neutral" as const;
}

export function ComplianceViolationTable({
  violations,
}: {
  violations: ComplianceViolationRow[];
}) {
  if (violations.length === 0) {
    return <FormHint>No compliance violations.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Title</TH>
          <TH>Framework</TH>
          <TH>Severity</TH>
          <TH>Status</TH>
          <TH>Detected</TH>
        </TR>
      </THead>
      <TBody>
        {violations.map((row) => (
          <TR key={row.id}>
            <TD>
              <div className="font-medium">{row.title}</div>
              <div className="font-mono text-[10px] text-[var(--tc-muted)]">{row.ruleKey}</div>
            </TD>
            <TD className="font-mono text-xs">{row.framework}</TD>
            <TD>
              <Badge tone={severityTone(row.severity)}>{row.severity}</Badge>
            </TD>
            <TD>
              <Badge tone={row.status === "open" ? "warning" : "neutral"}>{row.status}</Badge>
            </TD>
            <TD className="text-xs text-[var(--tc-muted)]">
              {new Date(row.detectedAt).toLocaleString()}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
