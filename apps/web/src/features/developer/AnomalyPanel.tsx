import { Badge, FormHint } from "@trustchain/ui";

export type AnomalyRow = {
  id: string;
  type: string;
  severity: "info" | "warn" | "critical";
  message: string;
  value: number;
  threshold: number;
};

export function AnomalyPanel({ anomalies }: { anomalies: AnomalyRow[] }) {
  if (anomalies.length === 0) {
    return <FormHint>No anomalies detected in the selected window.</FormHint>;
  }

  return (
    <ul className="space-y-3">
      {anomalies.map((row) => (
        <li
          key={row.id}
          className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge
              tone={
                row.severity === "critical"
                  ? "danger"
                  : row.severity === "warn"
                    ? "warning"
                    : "neutral"
              }
            >
              {row.severity}
            </Badge>
            <span className="font-mono text-xs text-[var(--tc-muted)]">{row.type}</span>
          </div>
          <p>{row.message}</p>
        </li>
      ))}
    </ul>
  );
}
