import assert from "node:assert/strict";
import {
  SignatureApprovalStatuses,
  SignatureApprovalWorkflowStatuses,
  SignatureApprovalWorkflowTypes,
} from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import {
  assertReviewerCanAct,
  evaluateAfterApproval,
  evaluateAfterRejection,
  generateWorkflowPublicId,
  isWorkflowExpired,
  normalizeReviewerSteps,
  resolveWorkflowStatus,
  type ApprovalRowLike,
  type WorkflowRowLike,
} from "../signatures.approval.js";

function approvals(
  rows: Array<{ id: string; reviewerId: string; stepOrder: number; status?: string }>,
): ApprovalRowLike[] {
  return rows.map((r) => ({
    id: r.id,
    reviewerId: r.reviewerId,
    stepOrder: r.stepOrder,
    status: r.status ?? SignatureApprovalStatuses.pending,
  }));
}

export function testSequentialWorkflows(): void {
  const steps = normalizeReviewerSteps(SignatureApprovalWorkflowTypes.sequential, [
    { reviewerId: "r1" },
    { reviewerId: "r2" },
    { reviewerId: "r3" },
  ]);
  assert.deepEqual(
    steps.map((s) => s.stepOrder),
    [1, 2, 3],
  );

  const workflow: WorkflowRowLike = {
    id: "w1",
    workflowType: SignatureApprovalWorkflowTypes.sequential,
    status: SignatureApprovalWorkflowStatuses.pending,
    thresholdCount: null,
    currentStep: 1,
    expiresAt: null,
  };
  const rows = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1 },
    { id: "a2", reviewerId: "r2", stepOrder: 2 },
    { id: "a3", reviewerId: "r3", stepOrder: 3 },
  ]);

  const step1 = evaluateAfterApproval(workflow, rows, "a1");
  assert.equal(step1.progressed, true);
  assert.equal(step1.currentStep, 2);
  assert.equal(step1.completed, false);

  const mid: WorkflowRowLike = { ...workflow, currentStep: 2 };
  const after1 = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1, status: SignatureApprovalStatuses.approved },
    { id: "a2", reviewerId: "r2", stepOrder: 2 },
    { id: "a3", reviewerId: "r3", stepOrder: 3 },
  ]);
  const step2 = evaluateAfterApproval(mid, after1, "a2");
  assert.equal(step2.currentStep, 3);

  const last: WorkflowRowLike = { ...workflow, currentStep: 3 };
  const after2 = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1, status: SignatureApprovalStatuses.approved },
    { id: "a2", reviewerId: "r2", stepOrder: 2, status: SignatureApprovalStatuses.approved },
    { id: "a3", reviewerId: "r3", stepOrder: 3 },
  ]);
  const done = evaluateAfterApproval(last, after2, "a3");
  assert.equal(done.completed, true);
  assert.equal(done.workflowStatus, SignatureApprovalWorkflowStatuses.approved);

  assert.throws(
    () => assertReviewerCanAct(mid, after1, "r3"),
    (error) => error instanceof AppError && error.code === "NOT_CURRENT_STEP",
  );
  assert.equal(assertReviewerCanAct(mid, after1, "r2").id, "a2");
}

export function testParallelWorkflows(): void {
  const workflow: WorkflowRowLike = {
    id: "w2",
    workflowType: SignatureApprovalWorkflowTypes.parallel,
    status: SignatureApprovalWorkflowStatuses.pending,
    thresholdCount: null,
    currentStep: 1,
    expiresAt: null,
  };
  const rows = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1 },
    { id: "a2", reviewerId: "r2", stepOrder: 1 },
  ]);
  const first = evaluateAfterApproval(workflow, rows, "a1");
  assert.equal(first.completed, false);
  assert.equal(first.workflowStatus, SignatureApprovalWorkflowStatuses.pending);

  const afterOne = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1, status: SignatureApprovalStatuses.approved },
    { id: "a2", reviewerId: "r2", stepOrder: 1 },
  ]);
  const second = evaluateAfterApproval(workflow, afterOne, "a2");
  assert.equal(second.completed, true);
  assert.equal(second.workflowStatus, SignatureApprovalWorkflowStatuses.approved);

  const normalized = normalizeReviewerSteps(SignatureApprovalWorkflowTypes.parallel, [
    { reviewerId: "r1", stepOrder: 9 },
    { reviewerId: "r2", stepOrder: 3 },
  ]);
  assert.ok(normalized.every((s) => s.stepOrder === 1));
}

export function testThresholdWorkflows(): void {
  const workflow: WorkflowRowLike = {
    id: "w3",
    workflowType: SignatureApprovalWorkflowTypes.threshold,
    status: SignatureApprovalWorkflowStatuses.pending,
    thresholdCount: 2,
    currentStep: 1,
    expiresAt: null,
  };
  const rows = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1 },
    { id: "a2", reviewerId: "r2", stepOrder: 1 },
    { id: "a3", reviewerId: "r3", stepOrder: 1 },
  ]);
  const first = evaluateAfterApproval(workflow, rows, "a1");
  assert.equal(first.completed, false);

  const afterOne = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1, status: SignatureApprovalStatuses.approved },
    { id: "a2", reviewerId: "r2", stepOrder: 1 },
    { id: "a3", reviewerId: "r3", stepOrder: 1 },
  ]);
  const second = evaluateAfterApproval(workflow, afterOne, "a2");
  assert.equal(second.completed, true);
  assert.equal(second.workflowStatus, SignatureApprovalWorkflowStatuses.approved);
  assert.deepEqual(second.skipApprovalIds, ["a3"]);
}

export function testApprovalHandling(): void {
  assert.match(generateWorkflowPublicId(), /^WF-/);
  const workflow: WorkflowRowLike = {
    id: "w4",
    workflowType: SignatureApprovalWorkflowTypes.parallel,
    status: SignatureApprovalWorkflowStatuses.pending,
    thresholdCount: null,
    currentStep: 1,
    expiresAt: null,
  };
  const rows = approvals([{ id: "a1", reviewerId: "r1", stepOrder: 1 }]);
  assert.equal(assertReviewerCanAct(workflow, rows, "r1").reviewerId, "r1");
  assert.throws(
    () => assertReviewerCanAct(workflow, rows, "outsider"),
    (error) => error instanceof AppError && error.code === "NOT_ASSIGNED_REVIEWER",
  );
}

export function testRejectionHandling(): void {
  const rows = approvals([
    { id: "a1", reviewerId: "r1", stepOrder: 1 },
    { id: "a2", reviewerId: "r2", stepOrder: 1 },
  ]);
  const result = evaluateAfterRejection(rows, "a1");
  assert.equal(result.workflowStatus, SignatureApprovalWorkflowStatuses.rejected);
  assert.equal(result.completed, true);
  assert.deepEqual(result.skipApprovalIds, ["a2"]);
}

export function testCancellationHandling(): void {
  // Cancellation is a terminal status transition — model it as status check.
  function canCancel(status: string): boolean {
    return resolveWorkflowStatus(status, null) === SignatureApprovalWorkflowStatuses.pending;
  }
  assert.equal(canCancel(SignatureApprovalWorkflowStatuses.pending), true);
  assert.equal(canCancel(SignatureApprovalWorkflowStatuses.approved), false);
  assert.equal(canCancel(SignatureApprovalWorkflowStatuses.rejected), false);
  assert.equal(canCancel(SignatureApprovalWorkflowStatuses.cancelled), false);
}

export function testExpirationHandling(): void {
  const now = new Date("2026-08-03T12:00:00.000Z");
  const past = new Date("2026-01-01T00:00:00.000Z");
  const future = new Date("2027-01-01T00:00:00.000Z");

  assert.equal(
    isWorkflowExpired(SignatureApprovalWorkflowStatuses.pending, past, now),
    true,
  );
  assert.equal(
    isWorkflowExpired(SignatureApprovalWorkflowStatuses.pending, future, now),
    false,
  );
  assert.equal(
    resolveWorkflowStatus(SignatureApprovalWorkflowStatuses.pending, past, now),
    SignatureApprovalWorkflowStatuses.expired,
  );
  assert.equal(
    resolveWorkflowStatus(SignatureApprovalWorkflowStatuses.approved, past, now),
    SignatureApprovalWorkflowStatuses.approved,
  );

  const workflow: WorkflowRowLike = {
    id: "w5",
    workflowType: SignatureApprovalWorkflowTypes.parallel,
    status: SignatureApprovalWorkflowStatuses.pending,
    thresholdCount: null,
    currentStep: 1,
    expiresAt: past,
  };
  assert.throws(
    () =>
      assertReviewerCanAct(
        workflow,
        approvals([{ id: "a1", reviewerId: "r1", stepOrder: 1 }]),
        "r1",
        now,
      ),
    (error) => error instanceof AppError && error.code === "WORKFLOW_EXPIRED",
  );
}
