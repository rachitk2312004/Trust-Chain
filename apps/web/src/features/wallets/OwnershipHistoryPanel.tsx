import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";
import type { OwnershipEvent, WalletOwnershipReport } from "../../services/walletApi";

export function OwnershipHistoryPanel({
  events,
  report,
}: {
  events: OwnershipEvent[];
  report?: WalletOwnershipReport | null;
}) {
  return (
    <div className="space-y-4">
      {report ? (
        <div className="rounded border border-[var(--tc-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
            Ownership summary
          </div>
          <p className="mt-2 text-sm">
            {report.verified}/{report.total} verified · primary {report.primaryCount} · health{" "}
            {Math.round(report.healthScore * 100)}%
          </p>
        </div>
      ) : null}

      {events.length === 0 ? (
        <FormHint>No ownership events yet.</FormHint>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Event</TH>
              <TH>Address</TH>
              <TH>When</TH>
            </TR>
          </THead>
          <TBody>
            {events.map((e) => (
              <TR key={e.id}>
                <TD>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{e.eventType}</Badge>
                    <span className="text-sm">{e.summary}</span>
                  </div>
                </TD>
                <TD className="max-w-[180px] truncate font-mono text-xs">
                  {e.address ?? "—"}
                </TD>
                <TD className="text-xs">{new Date(e.createdAt).toLocaleString()}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
