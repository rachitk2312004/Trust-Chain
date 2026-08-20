import { Badge, FormHint } from "@trustchain/ui";
import type { PlatformHealthReport } from "../../services/platformApi";

export function HealthStatusCard({ health }: { health: PlatformHealthReport }) {
  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--tc-muted)]">
          Dependency health
        </h3>
        <Badge
          tone={
            health.status === "ok"
              ? "success"
              : health.status === "down"
                ? "danger"
                : "neutral"
          }
        >
          {health.status}
        </Badge>
      </div>
      <p className="mb-3 text-xs text-[var(--tc-muted)]">
        Uptime {health.uptimeSeconds}s · PID {health.process.pid} ·{" "}
        {health.process.nodeVersion}
      </p>
      {health.checks.length === 0 ? (
        <FormHint>No dependency checks returned.</FormHint>
      ) : (
        <ul className="space-y-2">
          {health.checks.map((c) => (
            <li
              key={c.name}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--tc-border)] pb-2 last:border-0"
            >
              <div>
                <div className="font-mono text-sm">{c.name}</div>
                <div className="text-xs text-[var(--tc-muted)]">{c.detail ?? "—"}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-[var(--tc-muted)]">
                  {c.latencyMs != null ? `${c.latencyMs}ms` : "—"}
                </span>
                <Badge
                  tone={
                    c.status === "ok"
                      ? "success"
                      : c.status === "down"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {c.status}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
