import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  FormHint,
  Input,
} from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import type { AdminPolicyEvaluation } from "../../types/api";
import { useEvaluateAdminPolicies } from "./hooks";
import { PolicyConflictViewer } from "./PolicyConflictViewer";

const POLICY_TYPES = [
  "",
  "permission",
  "quota",
  "retention",
  "workflow",
  "feature",
  "organization",
] as const;

function decisionTone(decision: string) {
  if (decision === "allow") return "success" as const;
  if (decision === "deny") return "danger" as const;
  if (decision === "conflict") return "warning" as const;
  return "neutral" as const;
}

export function PolicyEvaluationPanel() {
  const feedback = useFeedback();
  const evaluate = useEvaluateAdminPolicies();
  const [organizationId, setOrganizationId] = useState("");
  const [policyType, setPolicyType] = useState("");
  const [capability, setCapability] = useState("admin.view");
  const [resource, setResource] = useState("users");
  const [usage, setUsage] = useState("0");
  const [featureKey, setFeatureKey] = useState("beta");
  const [retentionAgeDays, setRetentionAgeDays] = useState("0");
  const [result, setResult] = useState<AdminPolicyEvaluation | null>(null);

  const run = () => {
    evaluate.mutate(
      {
        organizationId: organizationId.trim() || null,
        policyType: policyType || undefined,
        includeGlobal: true,
        context: {
          capability: capability.trim() || undefined,
          resource: resource.trim() || undefined,
          usage: Number.parseFloat(usage) || 0,
          featureKey: featureKey.trim() || undefined,
          retentionAgeDays: Number.parseFloat(retentionAgeDays) || 0,
        },
      },
      {
        onSuccess: (data) => {
          setResult(data.evaluation);
          feedback.success(`Decision: ${data.evaluation.decision}`);
        },
        onError: (err) => feedback.error(err, "Evaluation failed"),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evaluate policies</CardTitle>
        <CardDescription>
          Run the policy engine against an organization context. Conflicts are reported without
          auto-enforcement.
        </CardDescription>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Organization ID (optional)</label>
          <Input
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            placeholder="UUID"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Policy type</label>
          <select
            className="h-10 w-full rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
            value={policyType}
            onChange={(e) => setPolicyType(e.target.value)}
          >
            {POLICY_TYPES.map((type) => (
              <option key={type || "all"} value={type}>
                {type || "all types"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Capability</label>
          <Input value={capability} onChange={(e) => setCapability(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Quota resource</label>
          <Input value={resource} onChange={(e) => setResource(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Quota usage</label>
          <Input type="number" min={0} value={usage} onChange={(e) => setUsage(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Feature key</label>
          <Input value={featureKey} onChange={(e) => setFeatureKey(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Retention age (days)</label>
          <Input
            type="number"
            min={0}
            value={retentionAgeDays}
            onChange={(e) => setRetentionAgeDays(e.target.value)}
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button disabled={evaluate.isPending} onClick={run}>
          {evaluate.isPending ? "Evaluating…" : "Evaluate"}
        </Button>
      </div>
      <FormError>{evaluate.error ? getApiErrorMessage(evaluate.error) : null}</FormError>

      {result ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={decisionTone(result.decision)}>{result.decision}</Badge>
            <FormHint>{result.reason}</FormHint>
          </div>
          <PolicyConflictViewer conflicts={result.conflicts} />
          {result.evaluations.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {result.evaluations.map((item, idx) => (
                <li key={`${item.policyId ?? "none"}-${idx}`}>
                  <Badge tone={decisionTone(item.decision)}>{item.decision}</Badge>{" "}
                  {item.reason}
                </li>
              ))}
            </ul>
          ) : null}
          <pre className="overflow-auto rounded border border-[var(--tc-border)] bg-[var(--tc-surface)] p-3 text-xs">
            {JSON.stringify(result.effectiveRules, null, 2)}
          </pre>
        </div>
      ) : null}
    </Card>
  );
}
