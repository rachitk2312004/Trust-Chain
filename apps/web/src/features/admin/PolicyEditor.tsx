import { useState } from "react";
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  Input,
  Textarea,
} from "@trustchain/ui";
import { getApiErrorMessage } from "../../lib/apiErrors";
import { useFeedback } from "../../hooks/useFeedback";
import type { AdminPolicy } from "../../types/api";
import { useCreateAdminPolicy, usePatchAdminPolicy } from "./hooks";

const POLICY_TYPES = [
  "permission",
  "quota",
  "retention",
  "workflow",
  "feature",
  "organization",
] as const;

const DEFAULT_RULES: Record<(typeof POLICY_TYPES)[number], string> = {
  permission: '{\n  "grant": ["admin.view"],\n  "deny": []\n}',
  quota: '{\n  "limits": {\n    "users": 50,\n    "documents": 1000\n  }\n}',
  retention: '{\n  "retainDays": 365,\n  "action": "archive"\n}',
  workflow: '{\n  "requiredApprovals": 1,\n  "steps": ["review", "approve"]\n}',
  feature: '{\n  "features": {\n    "beta": true\n  }\n}',
  organization: '{\n  "allowedStatuses": ["active"],\n  "maxChildren": 10\n}',
};

export function PolicyEditor({
  mode,
  policy,
  onSaved,
}: {
  mode: "create" | "edit";
  policy?: AdminPolicy;
  onSaved?: (policyId: string) => void;
}) {
  const feedback = useFeedback();
  const create = useCreateAdminPolicy();
  const patch = usePatchAdminPolicy();
  const [name, setName] = useState(policy?.name ?? "");
  const [description, setDescription] = useState(policy?.description ?? "");
  const [policyType, setPolicyType] = useState<(typeof POLICY_TYPES)[number]>(
    (policy?.policyType as (typeof POLICY_TYPES)[number]) ?? "permission",
  );
  const [status, setStatus] = useState(policy?.status ?? "draft");
  const [priority, setPriority] = useState(String(policy?.priority ?? 100));
  const [parentPolicyId, setParentPolicyId] = useState(policy?.parentPolicyId ?? "");
  const [rulesText, setRulesText] = useState(
    policy ? JSON.stringify(policy.rules, null, 2) : DEFAULT_RULES.permission,
  );

  const pending = create.isPending || patch.isPending;
  const error = create.error || patch.error;

  const submit = () => {
    let rules: Record<string, unknown>;
    try {
      rules = JSON.parse(rulesText) as Record<string, unknown>;
    } catch {
      feedback.error(new Error("Rules must be valid JSON"), "Invalid rules");
      return;
    }

    if (mode === "create") {
      create.mutate(
        {
          name: name.trim(),
          description: description.trim() || null,
          policyType,
          status,
          priority: Number.parseInt(priority, 10) || 100,
          parentPolicyId: parentPolicyId.trim() || null,
          rules,
        },
        {
          onSuccess: (data) => {
            feedback.success("Policy created");
            onSaved?.(data.policy.id);
          },
          onError: (err) => feedback.error(err, "Create failed"),
        },
      );
      return;
    }

    if (!policy) return;
    patch.mutate(
      {
        policyId: policy.id,
        body: {
          name: name.trim(),
          description: description.trim() || null,
          status,
          priority: Number.parseInt(priority, 10) || 100,
          parentPolicyId: parentPolicyId.trim() || null,
          rules,
        },
      },
      {
        onSuccess: (data) => {
          feedback.success("Policy updated");
          onSaved?.(data.policy.id);
        },
        onError: (err) => feedback.error(err, "Update failed"),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === "create" ? "Create policy" : "Edit policy"}</CardTitle>
        <CardDescription>
          Define permission, quota, retention, workflow, feature, or organization rules.
        </CardDescription>
      </CardHeader>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Type</label>
          <select
            className="h-10 w-full rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
            value={policyType}
            disabled={mode === "edit"}
            onChange={(e) => {
              const next = e.target.value as (typeof POLICY_TYPES)[number];
              setPolicyType(next);
              if (mode === "create") setRulesText(DEFAULT_RULES[next]);
            }}
          >
            {POLICY_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Status</label>
          <select
            className="h-10 w-full rounded-md border border-[var(--tc-border)] bg-[var(--tc-surface)] px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="draft">draft</option>
            <option value="active">active</option>
            <option value="disabled">disabled</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium">Priority</label>
          <Input
            type="number"
            min={0}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium">Parent policy ID (optional)</label>
          <Input
            value={parentPolicyId}
            onChange={(e) => setParentPolicyId(e.target.value)}
            placeholder="UUID for inheritance"
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium">Description</label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium">Rules (JSON)</label>
          <Textarea
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
            rows={8}
            className="font-mono text-xs"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button disabled={!name.trim() || pending} onClick={submit}>
          {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
        </Button>
      </div>
      <FormError>{error ? getApiErrorMessage(error) : null}</FormError>
    </Card>
  );
}
