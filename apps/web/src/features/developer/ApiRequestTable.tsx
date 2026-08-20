import { Badge, FormHint, Table, TBody, TD, TH, THead, TR } from "@trustchain/ui";

export type ApiRequestRow = {
  id: string;
  method: string;
  path: string;
  statusCode: number;
  requestId: string | null;
  durationMs: number | null;
  createdAt: string;
  apiKeyId: string | null;
};

function statusTone(code: number) {
  if (code >= 200 && code < 300) return "success" as const;
  if (code >= 400 && code < 500) return "warning" as const;
  if (code >= 500) return "danger" as const;
  return "neutral" as const;
}

export function ApiRequestTable({ requests }: { requests: ApiRequestRow[] }) {
  if (requests.length === 0) {
    return <FormHint>No API requests recorded yet.</FormHint>;
  }

  return (
    <Table>
      <THead>
        <TR>
          <TH>When</TH>
          <TH>Method</TH>
          <TH>Path</TH>
          <TH>Status</TH>
          <TH>Latency</TH>
          <TH>Request ID</TH>
        </TR>
      </THead>
      <TBody>
        {requests.map((row) => (
          <TR key={row.id}>
            <TD className="text-xs text-[var(--tc-muted)]">
              {new Date(row.createdAt).toLocaleString()}
            </TD>
            <TD className="font-mono text-xs">{row.method}</TD>
            <TD className="max-w-[240px] truncate text-xs">{row.path}</TD>
            <TD>
              <Badge tone={statusTone(row.statusCode)}>{row.statusCode}</Badge>
            </TD>
            <TD className="text-xs">{row.durationMs != null ? `${row.durationMs}ms` : "—"}</TD>
            <TD className="font-mono text-xs text-[var(--tc-muted)]">
              {row.requestId ? `${row.requestId.slice(0, 8)}…` : "—"}
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}
