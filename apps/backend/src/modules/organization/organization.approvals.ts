import { OrgPlatformDefaults } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type ApprovalStepInput = {
  stepOrder: number;
  approverType: string;
  approverRef: string;
  name?: string | null;
};

export type ApprovalChainContext = {
  resourceType: string;
  resourceOwnerUserId?: string | null;
  managerUserId?: string | null;
  roleKeys?: string[];
  actorUserId: string;
};

export function validateApprovalSteps(steps: ApprovalStepInput[]): ApprovalStepInput[] {
  if (steps.length === 0) {
    throw new AppError(400, "VALIDATION_ERROR", "At least one approval step required");
  }
  if (steps.length > OrgPlatformDefaults.maxApprovalSteps) {
    throw new AppError(400, "VALIDATION_ERROR", "Too many approval steps");
  }
  const orders = new Set<number>();
  const normalized = [...steps]
    .map((s) => ({
      stepOrder: s.stepOrder,
      approverType: s.approverType.trim(),
      approverRef: s.approverRef.trim(),
      name: s.name?.trim() || null,
    }))
    .sort((a, b) => a.stepOrder - b.stepOrder);

  for (const step of normalized) {
    if (orders.has(step.stepOrder)) {
      throw new AppError(400, "VALIDATION_ERROR", "Duplicate approval step order");
    }
    orders.add(step.stepOrder);
    if (!step.approverType || !step.approverRef) {
      throw new AppError(400, "VALIDATION_ERROR", "Approver type and ref required");
    }
  }
  return normalized;
}

/**
 * Resolve who must approve at each step for a given context.
 */
export function resolveApprovalChain(
  steps: ApprovalStepInput[],
  ctx: ApprovalChainContext,
): Array<{
  stepOrder: number;
  approverType: string;
  approverRef: string;
  resolvedUserId: string | null;
  autoApprove: boolean;
}> {
  return validateApprovalSteps(steps).map((step) => {
    let resolvedUserId: string | null = null;
    if (step.approverType === "owner") {
      resolvedUserId = ctx.resourceOwnerUserId ?? null;
    } else if (step.approverType === "manager") {
      resolvedUserId = ctx.managerUserId ?? null;
    } else if (step.approverType === "user") {
      resolvedUserId = step.approverRef;
    } else if (step.approverType === "role") {
      resolvedUserId = null; // role-based — any holder
    }

    const autoApprove =
      Boolean(resolvedUserId) && resolvedUserId === ctx.actorUserId && step.approverType !== "role";

    return {
      stepOrder: step.stepOrder,
      approverType: step.approverType,
      approverRef: step.approverRef,
      resolvedUserId,
      autoApprove,
    };
  });
}

export function evaluateApprovalProgress(input: {
  steps: Array<{ stepOrder: number; autoApprove: boolean }>;
  completedOrders: number[];
}): {
  nextStepOrder: number | null;
  completed: boolean;
  pendingCount: number;
} {
  const completed = new Set(input.completedOrders);
  const remaining = input.steps
    .filter((s) => !completed.has(s.stepOrder) && !s.autoApprove)
    .sort((a, b) => a.stepOrder - b.stepOrder);
  // auto-approve steps count as completed
  for (const s of input.steps) {
    if (s.autoApprove) completed.add(s.stepOrder);
  }
  const stillPending = input.steps.filter((s) => !completed.has(s.stepOrder));
  return {
    nextStepOrder: remaining[0]?.stepOrder ?? null,
    completed: stillPending.length === 0,
    pendingCount: stillPending.length,
  };
}
