import { Badge, FormHint } from "@trustchain/ui";
import type { ControlAssessment, ControlEvaluation } from "../../services/governanceApi";

export function ControlAssessmentPanel({
  evaluations,
  assessments,
  coverageScore,
}: {
  evaluations: ControlEvaluation[];
  assessments: ControlAssessment[];
  coverageScore: number;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded border border-[var(--tc-border)] p-4">
        <div className="text-xs uppercase tracking-wide text-[var(--tc-muted)]">
          Control coverage
        </div>
        <div className="mt-1 text-3xl font-semibold">{Math.round(coverageScore * 100)}%</div>
        <p className="mt-1 text-xs text-[var(--tc-muted)]">
          {evaluations.filter((e) => e.passed).length} / {evaluations.length} catalog controls
          passing
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Catalog evaluation</h3>
        {evaluations.length === 0 ? (
          <FormHint>No controls evaluated.</FormHint>
        ) : (
          <ul className="space-y-2">
            {evaluations.slice(0, 12).map((e) => (
              <li
                key={e.controlKey}
                className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{e.title}</span>
                  <Badge tone={e.passed ? "success" : "danger"}>
                    {e.passed ? "pass" : "fail"}
                  </Badge>
                </div>
                <div className="mt-1 font-mono text-xs text-[var(--tc-muted)]">
                  {e.framework} · {e.controlKey}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">Recent assessments</h3>
        {assessments.length === 0 ? (
          <FormHint>No assessment workflows recorded yet.</FormHint>
        ) : (
          <ul className="space-y-2">
            {assessments.slice(0, 8).map((a) => (
              <li
                key={a.id}
                className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <span>{a.controlTitle}</span>
                  <Badge
                    tone={
                      a.status === "passed"
                        ? "success"
                        : a.status === "failed"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {a.status}
                  </Badge>
                </div>
                <div className="text-xs text-[var(--tc-muted)]">
                  {a.framework} · score {Math.round(a.score * 100)}%
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
