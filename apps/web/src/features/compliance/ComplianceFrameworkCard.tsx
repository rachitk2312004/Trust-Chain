import { Badge, Button } from "@trustchain/ui";

export type FrameworkCardData = {
  id: string;
  name: string;
  description: string;
  version: string;
  ruleCount: number;
  score?: number;
};

export function ComplianceFrameworkCard({
  framework,
  onRun,
  running,
}: {
  framework: FrameworkCardData;
  onRun?: (frameworkId: string) => void;
  running?: boolean;
}) {
  return (
    <article className="rounded border border-[var(--tc-border)] p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{framework.name}</h3>
        <Badge tone="neutral">v{framework.version}</Badge>
        <Badge tone="neutral">{framework.ruleCount} rules</Badge>
      </div>
      <p className="text-sm text-[var(--tc-muted)]">{framework.description}</p>
      {framework.score != null ? (
        <p className="mt-2 text-sm">
          Latest score: <span className="font-semibold">{Math.round(framework.score * 100)}%</span>
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--tc-muted)]">No assessment yet</p>
      )}
      {onRun ? (
        <div className="mt-4">
          <Button
            type="button"
            size="sm"
            disabled={running}
            onClick={() => onRun(framework.id)}
          >
            {running ? "Running…" : "Run check"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}
