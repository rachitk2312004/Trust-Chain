import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminFeatureAnalytics } from "../../types/api";

export function AdminFeatureMetrics({ data }: { data: AdminFeatureAnalytics | undefined }) {
  if (!data) return <FormHint>No feature metrics.</FormHint>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature flag metrics</CardTitle>
        <CardDescription>
          {data.active}/{data.total} active · avg rollout {data.averageRolloutPercent ?? "—"}%
        </CardDescription>
      </CardHeader>
      <div className="mb-3 flex flex-wrap gap-2">
        <Badge tone={data.killSwitchCount > 0 ? "warning" : "success"}>
          kill switches: {data.killSwitchCount}
        </Badge>
        {Object.entries(data.byStatus).map(([status, count]) => (
          <Badge key={status}>
            {status}: {count}
          </Badge>
        ))}
      </div>
      {data.flags && data.flags.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {data.flags.slice(0, 12).map((flag) => (
            <li key={flag.key} className="flex justify-between gap-2">
              <span className="font-mono text-xs">
                {flag.key}
                {flag.killSwitch ? " · killed" : ""}
              </span>
              <span className="text-[var(--tc-muted)]">
                {flag.status} · {flag.rolloutPercent}%
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <FormHint>No flag details.</FormHint>
      )}
    </Card>
  );
}
