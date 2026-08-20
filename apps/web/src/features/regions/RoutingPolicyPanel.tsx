import { Badge, FormHint } from "@trustchain/ui";

export function RoutingPolicyPanel({
  decision,
  loading,
}: {
  decision?: {
    decision: { regionCode: string; reason: string };
    residency: { homeRegionCode: string; mode: string; allowedRegions: string[] };
    routing: { strategy: string };
  } | null;
  loading?: boolean;
}) {
  if (loading) {
    return <p className="text-sm text-[var(--tc-muted)]">Evaluating routing…</p>;
  }
  if (!decision) {
    return (
      <FormHint>
        Configure residency/routing policies (create a region with organizationId) to evaluate
        routing.
      </FormHint>
    );
  }

  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <h2 className="mb-2 text-sm font-semibold">Routing decision</h2>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="success">{decision.decision.regionCode}</Badge>
        <span className="text-xs text-[var(--tc-muted)]">{decision.decision.reason}</span>
      </div>
      <p className="mt-3 text-xs text-[var(--tc-muted)]">
        strategy <span className="font-mono">{decision.routing.strategy}</span> · home{" "}
        <span className="font-mono">{decision.residency.homeRegionCode}</span> · mode{" "}
        <span className="font-mono">{decision.residency.mode}</span>
      </p>
      <p className="mt-1 font-mono text-xs text-[var(--tc-muted)]">
        allowed: {decision.residency.allowedRegions.join(", ") || "—"}
      </p>
    </div>
  );
}
