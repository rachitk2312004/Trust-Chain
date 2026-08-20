import { useState } from "react";
import { Badge, Button, FormHint, Input, Label } from "@trustchain/ui";
import type { OrgApproval } from "../../services/organizationPlatformApi";

export function ApprovalWorkflowCard({
  approvals,
  pending,
  onCreate,
}: {
  approvals: OrgApproval[];
  pending?: boolean;
  onCreate: (input: {
    name: string;
    resourceType: string;
    steps: Array<{ stepOrder: number; approverType: string; approverRef: string }>;
  }) => void;
}) {
  const [name, setName] = useState("Department change approval");
  const [resourceType, setResourceType] = useState("department");
  const [approverRef, setApproverRef] = useState("org_admin");

  return (
    <div className="rounded border border-[var(--tc-border)] p-4">
      <h2 className="mb-2 text-sm font-semibold">Approval workflows</h2>
      <FormHint>Define multi-step approval chains for organizational changes.</FormHint>

      <form
        className="mt-3 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          onCreate({
            name,
            resourceType,
            steps: [
              { stepOrder: 1, approverType: "owner", approverRef: "owner" },
              { stepOrder: 2, approverType: "role", approverRef },
            ],
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="appr-name">Name</Label>
            <Input id="appr-name" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="appr-type">Resource</Label>
            <select
              id="appr-type"
              className="mt-1 w-full rounded border border-[var(--tc-border)] bg-transparent px-3 py-2 text-sm"
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value)}
            >
              <option value="department">department</option>
              <option value="business_unit">business_unit</option>
              <option value="cost_center">cost_center</option>
              <option value="document">document</option>
              <option value="spend">spend</option>
            </select>
          </div>
          <div>
            <Label htmlFor="appr-role">Second-step role</Label>
            <Input
              id="appr-role"
              value={approverRef}
              onChange={(e) => setApproverRef(e.target.value)}
              required
            />
          </div>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create workflow"}
        </Button>
      </form>

      <ul className="mt-4 space-y-2">
        {approvals.map((a) => (
          <li key={a.id} className="rounded border border-[var(--tc-border)] px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{a.name}</span>
              <Badge tone="neutral">{a.resourceType}</Badge>
              <Badge tone={a.status === "active" ? "success" : "neutral"}>{a.status}</Badge>
            </div>
            <p className="mt-1 font-mono text-xs text-[var(--tc-muted)]">
              {a.steps
                .map((s) => `${s.stepOrder}:${s.approverType}/${s.approverRef}`)
                .join(" → ")}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
