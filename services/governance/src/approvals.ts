import type { ApprovalStatus } from "../../shared/types.js";

export type ApprovalRequest = {
  id: string;
  subject: string;
  requestedBy: string;
  status: ApprovalStatus;
  createdAt: string;
};

export function requestApproval(subject: string, requestedBy: string): ApprovalRequest {
  return {
    id: `APPROVAL-${Date.now()}`,
    subject,
    requestedBy,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

export function resolveApproval(
  request: ApprovalRequest,
  status: Extract<ApprovalStatus, "approved" | "rejected">,
): ApprovalRequest {
  return { ...request, status };
}
