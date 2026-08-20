import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { EcosystemIntegration } from "../../services/integrationApi";

export function IntegrationTable({
  integrations,
  onOAuth,
  onSync,
  onRotate,
  onDisable,
}: {
  integrations: EcosystemIntegration[];
  onOAuth?: (integration: EcosystemIntegration) => void;
  onSync?: (integration: EcosystemIntegration) => void;
  onRotate?: (integration: EcosystemIntegration) => void;
  onDisable?: (integration: EcosystemIntegration) => void;
}) {
  if (integrations.length === 0) {
    return <FormHint>No integrations installed yet. Browse the marketplace to add one.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Integration</TH>
          <TH>Connector</TH>
          <TH>Auth</TH>
          <TH>Status</TH>
          <TH>Sync</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {integrations.map((i) => (
          <TR key={i.id}>
            <TD>
              <div className="font-medium">{i.name}</div>
              <div className="text-xs text-[var(--tc-muted)]">
                {i.subscriptions.length} subscriptions
                {i.credential ? ` · ****${i.credential.secretLast4} v${i.credential.version}` : ""}
              </div>
            </TD>
            <TD>
              <div className="text-sm">{i.connectorName}</div>
              <div className="font-mono text-xs text-[var(--tc-muted)]">{i.category}</div>
            </TD>
            <TD className="font-mono text-xs">{i.authMode}</TD>
            <TD>
              <Badge
                tone={
                  i.status === "connected"
                    ? "success"
                    : i.status === "error"
                      ? "danger"
                      : "neutral"
                }
              >
                {i.status}
              </Badge>
            </TD>
            <TD className="text-xs">
              {i.syncMode} / {i.syncIntervalMinutes}m
              <div className="text-[var(--tc-muted)]">
                {i.lastSyncedAt ? new Date(i.lastSyncedAt).toLocaleString() : "never"}
              </div>
            </TD>
            <TD>
              <div className="flex flex-wrap gap-1">
                {onOAuth && i.authMode === "oauth" && i.status !== "connected" ? (
                  <Button type="button" variant="ghost" onClick={() => onOAuth(i)}>
                    OAuth
                  </Button>
                ) : null}
                {onSync ? (
                  <Button type="button" variant="ghost" onClick={() => onSync(i)}>
                    Sync
                  </Button>
                ) : null}
                {onRotate ? (
                  <Button type="button" variant="ghost" onClick={() => onRotate(i)}>
                    Rotate
                  </Button>
                ) : null}
                {onDisable && i.status !== "disabled" ? (
                  <Button type="button" variant="ghost" onClick={() => onDisable(i)}>
                    Disable
                  </Button>
                ) : null}
              </div>
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
