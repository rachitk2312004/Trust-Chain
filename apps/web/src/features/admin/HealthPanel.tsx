import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminHealthReport } from "../../types/api";

function toneFor(status: string) {
  if (status === "ok") return "success" as const;
  if (status === "degraded") return "warning" as const;
  return "danger" as const;
}

function formatBytes(value: number) {
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function HealthPanel({ report }: { report: AdminHealthReport | undefined }) {
  if (!report) return <FormHint>No health report.</FormHint>;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>System health</CardTitle>
          <CardDescription>
            <Badge tone={toneFor(report.status)}>{report.status}</Badge>
            <span className="ml-2 text-sm text-[var(--tc-muted)]">
              generated {new Date(report.generatedAt).toLocaleString()}
            </span>
          </CardDescription>
        </CardHeader>
        <dl className="grid gap-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[var(--tc-muted)]">Uptime</dt>
            <dd>{report.uptimeSeconds}s</dd>
          </div>
          <div>
            <dt className="text-[var(--tc-muted)]">Node</dt>
            <dd className="font-mono text-xs">{report.process.nodeVersion}</dd>
          </div>
          <div>
            <dt className="text-[var(--tc-muted)]">Memory RSS</dt>
            <dd>{formatBytes(report.process.memoryRssBytes)}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Checks</CardTitle>
          <CardDescription>{report.checks.length} probes</CardDescription>
        </CardHeader>
        <ul className="space-y-2 text-sm">
          {report.checks.map((check) => (
            <li key={check.name} className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs">{check.name}</span>
              <span className="flex items-center gap-2">
                {check.latencyMs != null ? (
                  <span className="text-[var(--tc-muted)]">{check.latencyMs}ms</span>
                ) : null}
                <Badge tone={toneFor(check.status)}>{check.status}</Badge>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
