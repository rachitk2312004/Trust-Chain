import { useState } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
} from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import {
  useAdminOperationsCleanup,
  useAdminOperationsReprocess,
} from "./hooks";

const TARGETS = ["tenants", "policies", "configuration", "audit", "diagnostics"] as const;

export function AdminOperationsPanel() {
  const feedback = useFeedback();
  const reprocess = useAdminOperationsReprocess();
  const cleanup = useAdminOperationsCleanup();
  const [targets, setTargets] = useState<string[]>([...TARGETS]);
  const [dryRun, setDryRun] = useState(true);
  const [lastResult, setLastResult] = useState<unknown>(null);

  const toggleTarget = (target: string) => {
    setTargets((prev) =>
      prev.includes(target) ? prev.filter((t) => t !== target) : [...prev, target],
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Administration operations</CardTitle>
        <CardDescription>
          Reprocess repairs tenants/policies/configuration and run retention cleanup. Prefer dry-run
          first.
        </CardDescription>
      </CardHeader>

      <div className="mb-3 flex flex-wrap gap-3">
        {TARGETS.map((target) => (
          <label key={target} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={targets.includes(target)}
              onChange={() => toggleTarget(target)}
            />
            {target}
          </label>
        ))}
      </div>

      <label className="mb-4 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        Dry run
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={targets.length === 0 || reprocess.isPending}
          onClick={() =>
            reprocess.mutate(
              { targets, dryRun },
              {
                onSuccess: (data) => {
                  setLastResult(data);
                  feedback.success(
                    dryRun
                      ? `Dry-run reprocess: ${data.repaired} planned`
                      : `Reprocessed: ${data.repaired} repaired`,
                  );
                },
                onError: (err) => feedback.error(err, "Reprocess failed"),
              },
            )
          }
        >
          {reprocess.isPending ? "Reprocessing…" : "Reprocess / repair"}
        </Button>
        <Button
          variant="ghost"
          disabled={cleanup.isPending}
          onClick={() =>
            cleanup.mutate(
              { dryRun },
              {
                onSuccess: (data) => {
                  setLastResult(data);
                  feedback.success(
                    dryRun
                      ? `Cleanup preview: ${data.cleanup.deletedAudit} audit rows eligible`
                      : `Cleanup removed ${data.cleanup.deletedAudit} audit rows`,
                  );
                },
                onError: (err) => feedback.error(err, "Cleanup failed"),
              },
            )
          }
        >
          {cleanup.isPending ? "Cleaning…" : "Retention cleanup"}
        </Button>
      </div>

      <FormError>
        {reprocess.error
          ? getApiErrorMessage(reprocess.error)
          : cleanup.error
            ? getApiErrorMessage(cleanup.error)
            : null}
      </FormError>

      {lastResult ? (
        <pre className="mt-4 max-h-64 overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
          {JSON.stringify(lastResult, null, 2)}
        </pre>
      ) : (
        <FormHint>Run an operation to see diagnostic output.</FormHint>
      )}
    </Card>
  );
}
