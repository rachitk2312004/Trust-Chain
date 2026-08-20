import { Badge, Card, CardDescription, CardHeader, CardTitle, FormHint } from "@trustchain/ui";
import type { AdminFeatureFlag } from "../../types/api";

export function FeatureInspector({
  features,
  active,
  killed,
}: {
  features: AdminFeatureFlag[];
  active?: number;
  killed?: number;
}) {
  if (!features.length) {
    return <FormHint>No feature flags in the inspection sample.</FormHint>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature inspection</CardTitle>
        <CardDescription>
          {features.length} sampled
          {active != null ? ` · ${active} active` : ""}
          {killed != null ? ` · ${killed} killed` : ""}
        </CardDescription>
      </CardHeader>
      <ul className="space-y-2 text-sm">
        {features.map((flag) => (
          <li key={flag.id} className="flex items-center justify-between gap-2">
            <div>
              <p className="font-mono text-xs">{flag.key}</p>
              <p className="text-xs text-[var(--tc-muted)]">{flag.publicCode}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--tc-muted)]">{flag.rolloutPercent}%</span>
              <Badge
                tone={
                  flag.killSwitch ? "danger" : flag.status === "active" ? "success" : "neutral"
                }
              >
                {flag.killSwitch ? "killed" : flag.status}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
