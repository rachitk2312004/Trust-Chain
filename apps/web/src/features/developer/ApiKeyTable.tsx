import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { DeveloperApiKey } from "../../types/api";

function statusTone(status: string) {
  if (status === "active") return "success" as const;
  if (status === "revoked" || status === "expired") return "danger" as const;
  if (status === "rotated") return "warning" as const;
  return "neutral" as const;
}

export function ApiKeyTable({
  keys,
  onRotate,
  onRevoke,
  busyId,
}: {
  keys: DeveloperApiKey[];
  onRotate?: (key: DeveloperApiKey) => void;
  onRevoke?: (key: DeveloperApiKey) => void;
  busyId?: string | null;
}) {
  if (keys.length === 0) {
    return <FormHint>No API keys yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Prefix</TH>
          <TH>Scopes</TH>
          <TH>Status</TH>
          <TH>Expires</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {keys.map((key) => (
          <TR key={key.id}>
            <TD>
              <div>{key.name}</div>
              <div className="font-mono text-xs text-[var(--tc-muted)]">{key.publicCode}</div>
            </TD>
            <TD className="font-mono text-xs">{key.keyPrefix}…</TD>
            <TD className="text-xs">{key.scopes.join(", ")}</TD>
            <TD>
              <Badge tone={statusTone(key.status)}>{key.status}</Badge>
            </TD>
            <TD className="text-xs">
              {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : "—"}
            </TD>
            <TD>
              <div className="flex gap-1">
                {key.status === "active" && onRotate ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === key.id}
                    onClick={() => onRotate(key)}
                  >
                    Rotate
                  </Button>
                ) : null}
                {(key.status === "active" || key.status === "expired") && onRevoke ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busyId === key.id}
                    onClick={() => onRevoke(key)}
                  >
                    Revoke
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
