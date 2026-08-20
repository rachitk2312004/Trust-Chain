import { Badge, Button } from "@trustchain/ui";
import type { ConnectorCatalogItem } from "../../services/integrationApi";

export function ConnectorCard({
  connector,
  installed,
  onInstall,
  pending,
}: {
  connector: ConnectorCatalogItem;
  installed?: boolean;
  onInstall?: () => void;
  pending?: boolean;
}) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{connector.name}</div>
          <div className="mt-1 flex gap-2">
            <Badge tone="neutral">{connector.category}</Badge>
            <Badge tone="neutral">{connector.authMode}</Badge>
          </div>
        </div>
        {installed ? <Badge tone="success">installed</Badge> : null}
      </div>
      <p className="mt-3 text-sm text-[var(--tc-muted)]">{connector.description}</p>
      <p className="mt-2 font-mono text-xs text-[var(--tc-muted)]">
        {connector.eventTypes.slice(0, 3).join(" · ")}
      </p>
      {onInstall && !installed ? (
        <div className="mt-4">
          <Button type="button" disabled={pending} onClick={onInstall}>
            {pending ? "Installing…" : "Install"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
