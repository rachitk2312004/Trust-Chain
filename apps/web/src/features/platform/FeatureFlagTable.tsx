import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { PlatformFeatureFlag } from "../../services/platformApi";

export function FeatureFlagTable({
  features,
  onToggleKill,
  togglingId,
}: {
  features: PlatformFeatureFlag[];
  onToggleKill?: (flag: PlatformFeatureFlag) => void;
  togglingId?: string | null;
}) {
  if (features.length === 0) {
    return <FormHint>No feature flags yet. Create them from Admin if needed.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Key</TH>
          <TH>Status</TH>
          <TH>Rollout</TH>
          <TH>Kill</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {features.map((f) => (
          <TR key={f.id}>
            <TD>
              <div className="font-medium">{f.key}</div>
              <div className="font-mono text-xs text-[var(--tc-muted)]">{f.publicCode}</div>
            </TD>
            <TD>
              <Badge tone={f.status === "active" ? "success" : "neutral"}>{f.status}</Badge>
            </TD>
            <TD className="font-mono text-xs">{f.rolloutPercent}%</TD>
            <TD>
              <Badge tone={f.killSwitch ? "danger" : "success"}>
                {f.killSwitch ? "on" : "off"}
              </Badge>
            </TD>
            <TD>
              {onToggleKill ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={togglingId === f.id}
                  onClick={() => onToggleKill(f)}
                >
                  {f.killSwitch ? "Clear kill" : "Kill switch"}
                </Button>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
