import { generateCode } from "../../../shared/types.js";
import type { ApprovalStatus } from "../../../shared/types.js";

export type DeploymentApproval = {
  deploymentCode: string;
  status: ApprovalStatus;
  requestedAt: string;
};

export function requestDeploymentApproval(): DeploymentApproval {
  return {
    deploymentCode: generateCode("DEPLOYMENT-"),
    status: "pending",
    requestedAt: new Date().toISOString(),
  };
}

export function isDeploymentApproved(approval: DeploymentApproval): boolean {
  return approval.status === "approved";
}
