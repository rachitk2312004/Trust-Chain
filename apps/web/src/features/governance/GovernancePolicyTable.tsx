import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { GovernancePolicy } from "../../services/governanceApi";

export function GovernancePolicyTable({
  policies,
  onActivate,
  activatingId,
}: {
  policies: GovernancePolicy[];
  onActivate?: (id: string) => void;
  activatingId?: string | null;
}) {
  if (policies.length === 0) {
    return <FormHint>No governance policies yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Policy</TH>
          <TH>Framework</TH>
          <TH>Status</TH>
          <TH>Version</TH>
          <TH>Owner</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {policies.map((p) => (
          <TR key={p.id}>
            <TD>
              <div className="font-medium">{p.title}</div>
              <div className="font-mono text-xs text-[var(--tc-muted)]">{p.key}</div>
            </TD>
            <TD className="font-mono text-xs">{p.framework}</TD>
            <TD>
              <Badge
                tone={
                  p.status === "active" ? "success" : p.status === "retired" ? "neutral" : "neutral"
                }
              >
                {p.status}
              </Badge>
            </TD>
            <TD className="text-xs">v{p.version}</TD>
            <TD className="font-mono text-xs">
              {p.ownerUserId ? `${p.ownerUserId.slice(0, 8)}…` : "—"}
            </TD>
            <TD>
              {onActivate && p.status !== "active" ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={activatingId === p.id}
                  onClick={() => onActivate(p.id)}
                >
                  Activate
                </Button>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
