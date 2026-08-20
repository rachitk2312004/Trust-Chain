import {
  SignatureApprovalStatuses,
  SignatureApprovalWorkflowStatuses,
  SignatureApprovalWorkflowTypes,
} from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { randomBytes } from "node:crypto";

export type ApprovalRowLike = {
  id: string;
  reviewerId: string;
  stepOrder: number;
  status: string;
};

export type WorkflowRowLike = {
  id: string;
  workflowType: string;
  status: string;
  thresholdCount: number | null;
  currentStep: number;
  expiresAt: Date | null;
};

export function generateWorkflowPublicId(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(4).toString("hex").toUpperCase();
  return `WF-${stamp}-${rand}`;
}

export function isWorkflowExpired(
  status: string,
  expiresAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (status === SignatureApprovalWorkflowStatuses.expired) return true;
  if (status !== SignatureApprovalWorkflowStatuses.pending) return false;
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

export function resolveWorkflowStatus(
  status: string,
  expiresAt: Date | null | undefined,
  now = new Date(),
): string {
  if (status !== SignatureApprovalWorkflowStatuses.pending) return status;
  if (isWorkflowExpired(status, expiresAt, now)) return SignatureApprovalWorkflowStatuses.expired;
  return status;
}

export function normalizeReviewerSteps(
  workflowType: string,
  reviewers: Array<{ reviewerId: string; stepOrder?: number }>,
): Array<{ reviewerId: string; stepOrder: number }> {
  if (workflowType === SignatureApprovalWorkflowTypes.sequential) {
    return reviewers.map((r, index) => ({
      reviewerId: r.reviewerId,
      stepOrder: r.stepOrder ?? index + 1,
    }));
  }
  // parallel + threshold: everyone at step 1
  return reviewers.map((r) => ({ reviewerId: r.reviewerId, stepOrder: 1 }));
}

export function assertReviewerCanAct(
  workflow: WorkflowRowLike,
  approvals: ApprovalRowLike[],
  reviewerId: string,
  now = new Date(),
): ApprovalRowLike {
  const status = resolveWorkflowStatus(workflow.status, workflow.expiresAt, now);
  if (status === SignatureApprovalWorkflowStatuses.expired) {
    throw new AppError(400, "WORKFLOW_EXPIRED", "Approval workflow has expired");
  }
  if (status !== SignatureApprovalWorkflowStatuses.pending) {
    throw new AppError(400, "WORKFLOW_NOT_PENDING", `Workflow is ${status} and cannot be reviewed`);
  }

  const mine = approvals.filter(
    (a) => a.reviewerId === reviewerId && a.status === SignatureApprovalStatuses.pending,
  );
  if (mine.length === 0) {
    throw new AppError(403, "NOT_ASSIGNED_REVIEWER", "You are not an active reviewer on this workflow");
  }

  if (workflow.workflowType === SignatureApprovalWorkflowTypes.sequential) {
    const current = mine.find((a) => a.stepOrder === workflow.currentStep);
    if (!current) {
      throw new AppError(
        403,
        "NOT_CURRENT_STEP",
        "It is not your turn to review this sequential workflow",
      );
    }
    return current;
  }

  return mine[0]!;
}

export type ProgressionResult = {
  workflowStatus: string;
  currentStep: number;
  skipApprovalIds: string[];
  completed: boolean;
  progressed: boolean;
};

/**
 * Pure progression after a single approval decision.
 */
export function evaluateAfterApproval(
  workflow: WorkflowRowLike,
  approvals: ApprovalRowLike[],
  decidedApprovalId: string,
): ProgressionResult {
  const nextApprovals = approvals.map((a) =>
    a.id === decidedApprovalId ? { ...a, status: SignatureApprovalStatuses.approved } : a,
  );

  if (workflow.workflowType === SignatureApprovalWorkflowTypes.sequential) {
    const maxStep = Math.max(...nextApprovals.map((a) => a.stepOrder), 1);
    const remainingAtStep = nextApprovals.filter(
      (a) =>
        a.stepOrder === workflow.currentStep && a.status === SignatureApprovalStatuses.pending,
    );
    if (remainingAtStep.length > 0) {
      return {
        workflowStatus: SignatureApprovalWorkflowStatuses.pending,
        currentStep: workflow.currentStep,
        skipApprovalIds: [],
        completed: false,
        progressed: false,
      };
    }
    if (workflow.currentStep >= maxStep) {
      return {
        workflowStatus: SignatureApprovalWorkflowStatuses.approved,
        currentStep: workflow.currentStep,
        skipApprovalIds: [],
        completed: true,
        progressed: false,
      };
    }
    return {
      workflowStatus: SignatureApprovalWorkflowStatuses.pending,
      currentStep: workflow.currentStep + 1,
      skipApprovalIds: [],
      completed: false,
      progressed: true,
    };
  }

  if (workflow.workflowType === SignatureApprovalWorkflowTypes.threshold) {
    const threshold = workflow.thresholdCount ?? nextApprovals.length;
    const approvedCount = nextApprovals.filter(
      (a) => a.status === SignatureApprovalStatuses.approved,
    ).length;
    if (approvedCount >= threshold) {
      const skipApprovalIds = nextApprovals
        .filter((a) => a.status === SignatureApprovalStatuses.pending)
        .map((a) => a.id);
      return {
        workflowStatus: SignatureApprovalWorkflowStatuses.approved,
        currentStep: workflow.currentStep,
        skipApprovalIds,
        completed: true,
        progressed: false,
      };
    }
    return {
      workflowStatus: SignatureApprovalWorkflowStatuses.pending,
      currentStep: workflow.currentStep,
      skipApprovalIds: [],
      completed: false,
      progressed: false,
    };
  }

  // parallel — all must approve
  const pending = nextApprovals.filter((a) => a.status === SignatureApprovalStatuses.pending);
  if (pending.length === 0) {
    return {
      workflowStatus: SignatureApprovalWorkflowStatuses.approved,
      currentStep: workflow.currentStep,
      skipApprovalIds: [],
      completed: true,
      progressed: false,
    };
  }
  return {
    workflowStatus: SignatureApprovalWorkflowStatuses.pending,
    currentStep: workflow.currentStep,
    skipApprovalIds: [],
    completed: false,
    progressed: false,
  };
}

export function evaluateAfterRejection(
  approvals: ApprovalRowLike[],
  decidedApprovalId: string,
): ProgressionResult {
  const skipApprovalIds = approvals
    .filter(
      (a) => a.id !== decidedApprovalId && a.status === SignatureApprovalStatuses.pending,
    )
    .map((a) => a.id);
  return {
    workflowStatus: SignatureApprovalWorkflowStatuses.rejected,
    currentStep: 0,
    skipApprovalIds,
    completed: true,
    progressed: false,
  };
}

export function countApprovalsByStatus(approvals: ApprovalRowLike[]) {
  return {
    pending: approvals.filter((a) => a.status === SignatureApprovalStatuses.pending).length,
    approved: approvals.filter((a) => a.status === SignatureApprovalStatuses.approved).length,
    rejected: approvals.filter((a) => a.status === SignatureApprovalStatuses.rejected).length,
    skipped: approvals.filter((a) => a.status === SignatureApprovalStatuses.skipped).length,
  };
}
