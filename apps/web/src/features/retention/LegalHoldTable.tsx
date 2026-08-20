import { Badge, Button, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { LegalHold } from "../../services/retentionApi";

export function LegalHoldTable({
  holds,
  onRelease,
  releasingId,
}: {
  holds: LegalHold[];
  onRelease?: (id: string) => void;
  releasingId?: string | null;
}) {
  if (holds.length === 0) {
    return <FormHint>No legal holds.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>Name</TH>
          <TH>Scope</TH>
          <TH>Status</TH>
          <TH>Starts</TH>
          <TH>Ends</TH>
          <TH />
        </TR>
      </THead>
      <TBody>
        {holds.map((h) => (
          <TR key={h.id}>
            <TD>
              <div className="font-medium">{h.name}</div>
              <div className="text-xs text-[var(--tc-muted)]">{h.reason}</div>
            </TD>
            <TD className="font-mono text-xs">
              {h.scope}
              {h.targetType ? ` · ${h.targetType}` : ""}
              {h.targetIds.length ? ` · ${h.targetIds.length} ids` : ""}
            </TD>
            <TD>
              <Badge tone={h.status === "active" ? "danger" : "neutral"}>{h.status}</Badge>
            </TD>
            <TD className="text-xs text-[var(--tc-muted)]">
              {new Date(h.startsAt).toLocaleString()}
            </TD>
            <TD className="text-xs text-[var(--tc-muted)]">
              {h.endsAt ? new Date(h.endsAt).toLocaleString() : "—"}
            </TD>
            <TD>
              {h.status === "active" && onRelease ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={releasingId === h.id}
                  onClick={() => onRelease(h.id)}
                >
                  Release
                </Button>
              ) : null}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
