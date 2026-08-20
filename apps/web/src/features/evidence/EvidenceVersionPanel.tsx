import { Badge, FormHint } from "@trustchain/ui";

export type EvidenceVersionRow = {
  id: string;
  version: number;
  checksumSha256: string;
  fileName: string | null;
  sizeBytes: number;
  changeNote: string | null;
  createdAt: string;
};

export function EvidenceVersionPanel({ versions }: { versions: EvidenceVersionRow[] }) {
  if (versions.length === 0) {
    return <FormHint>No versions recorded.</FormHint>;
  }

  return (
    <ol className="space-y-3">
      {versions.map((v) => (
        <li key={v.id} className="rounded border border-[var(--tc-border)] p-3 text-sm">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge tone="neutral">v{v.version}</Badge>
            <span className="text-xs text-[var(--tc-muted)]">
              {new Date(v.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="font-mono text-xs break-all">{v.checksumSha256}</div>
          <p className="mt-1 text-xs text-[var(--tc-muted)]">
            {v.fileName ?? "—"} · {v.sizeBytes} bytes
            {v.changeNote ? ` · ${v.changeNote}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
