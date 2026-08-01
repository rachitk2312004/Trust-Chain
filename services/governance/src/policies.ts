import type { ApprovalStatus } from "../../shared/types.js";

export type PolicyDraft = {
  id: string;
  name: string;
  description: string;
  rules: string[];
  approvalStatus: ApprovalStatus;
  createdAt: string;
};

export function createPolicyDraft(input: {
  name: string;
  description: string;
  rules: string[];
}): PolicyDraft {
  return {
    id: `POLICY-${Date.now()}`,
    name: input.name,
    description: input.description,
    rules: input.rules,
    approvalStatus: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function canActivatePolicy(draft: PolicyDraft): boolean {
  return draft.approvalStatus === "approved";
}
