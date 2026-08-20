import { FormHint } from "@trustchain/ui";
import type { AdminPolicyConflict } from "../../types/api";

export function PolicyConflictViewer({
  conflicts,
  emptyMessage = "No policy conflicts detected.",
}: {
  conflicts: AdminPolicyConflict[];
  emptyMessage?: string;
}) {
  if (conflicts.length === 0) {
    return <FormHint>{emptyMessage}</FormHint>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--tc-warning,#b45309)]">
        {conflicts.length} conflict{conflicts.length === 1 ? "" : "s"}
      </p>
      <ul className="space-y-2">
        {conflicts.map((conflict) => (
          <li
            key={`${conflict.leftPolicyId}-${conflict.rightPolicyId}-${conflict.key}`}
            className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm"
          >
            <div className="font-medium">
              {conflict.policyType} · {conflict.key}
            </div>
            <div className="text-[var(--tc-muted)]">{conflict.reason}</div>
            <div className="mt-1 font-mono text-xs">
              {conflict.leftPolicyId.slice(0, 8)}… ={" "}
              {JSON.stringify(conflict.leftValue)} vs {conflict.rightPolicyId.slice(0, 8)}… ={" "}
              {JSON.stringify(conflict.rightValue)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
