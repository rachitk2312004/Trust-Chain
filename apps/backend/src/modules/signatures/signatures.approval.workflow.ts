import {
  NotificationEventTypes,
  RoleKeys,
  SignatureApprovalEventTypes,
  SignatureApprovalStatuses,
  SignatureApprovalWorkflowStatuses,
  SignatureApprovalWorkflowTypes,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { emitDomainNotification } from "../notifications/notification.emit.js";
import {
  assertReviewerCanAct,
  countApprovalsByStatus,
  evaluateAfterApproval,
  evaluateAfterRejection,
  generateWorkflowPublicId,
  isWorkflowExpired,
  normalizeReviewerSteps,
  resolveWorkflowStatus,
} from "./signatures.approval.js";
import * as repo from "./signatures.approval.repository.js";

async function assertOrgStaff(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Insufficient permissions");
}

async function assertOrgAdmin(userId: string, organizationId: string) {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!allowed) throw new AppError(403, "FORBIDDEN", "Organization admin role required");
}

async function assertReviewersAreOrgMembers(
  organizationId: string,
  reviewerIds: string[],
) {
  for (const reviewerId of reviewerIds) {
    const ok = await userHasRole(
      reviewerId,
      [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
      organizationId,
    );
    if (!ok) {
      throw new AppError(
        400,
        "INVALID_REVIEWER",
        `Reviewer ${reviewerId} is not an organization member`,
      );
    }
  }
}

async function persistExpiredIfNeeded(workflow: {
  id: string;
  status: string;
  expiresAt: Date | null;
  organizationId: string;
}) {
  if (
    workflow.status === SignatureApprovalWorkflowStatuses.pending &&
    isWorkflowExpired(workflow.status, workflow.expiresAt)
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const next = await repo.updateWorkflow(
        workflow.id,
        {
          status: SignatureApprovalWorkflowStatuses.expired,
          completedAt: new Date(),
        },
        tx,
      );
      await repo.updateApprovalsMany(
        {
          workflowId: workflow.id,
          status: SignatureApprovalStatuses.pending,
        },
        { status: SignatureApprovalStatuses.expired },
        tx,
      );
      await repo.createApprovalEvent(
        {
          workflowId: workflow.id,
          organizationId: workflow.organizationId,
          eventType: SignatureApprovalEventTypes.expired,
          payloadJson: { reason: "expires_at" },
        },
        tx,
      );
      return next;
    });
    return updated;
  }
  return null;
}

export async function createApprovalWorkflow(
  userId: string,
  input: {
    organizationId: string;
    title: string;
    description?: string | null;
    workflowType: string;
    signatureId?: string | null;
    thresholdCount?: number | null;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
    reviewers: Array<{ reviewerId: string; stepOrder?: number }>;
  },
) {
  await assertOrgStaff(userId, input.organizationId);

  if (input.signatureId) {
    const signature = await prisma.signature.findFirst({
      where: { id: input.signatureId, organizationId: input.organizationId },
      select: { id: true },
    });
    if (!signature) throw new AppError(404, "SIGNATURE_NOT_FOUND", "Signature not found");
  }

  const steps = normalizeReviewerSteps(input.workflowType, input.reviewers);
  await assertReviewersAreOrgMembers(
    input.organizationId,
    steps.map((s) => s.reviewerId),
  );

  if (input.workflowType === SignatureApprovalWorkflowTypes.threshold) {
    if (!input.thresholdCount || input.thresholdCount < 1) {
      throw new AppError(400, "INVALID_THRESHOLD", "thresholdCount is required");
    }
    if (input.thresholdCount > steps.length) {
      throw new AppError(400, "INVALID_THRESHOLD", "thresholdCount exceeds reviewer count");
    }
  }

  const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new AppError(400, "INVALID_EXPIRATION", "Invalid expiration date");
  }
  if (expiresAt && expiresAt.getTime() <= Date.now()) {
    throw new AppError(400, "INVALID_EXPIRATION", "Expiration must be in the future");
  }

  const publicId = generateWorkflowPublicId();

  const created = await prisma.$transaction(async (tx) => {
    const workflow = await repo.createWorkflow(
      {
        publicId,
        organization: { connect: { id: input.organizationId } },
        ...(input.signatureId
          ? { signature: { connect: { id: input.signatureId } } }
          : {}),
        createdBy: { connect: { id: userId } },
        title: input.title.trim(),
        description: input.description?.trim() || null,
        workflowType: input.workflowType,
        status: SignatureApprovalWorkflowStatuses.pending,
        thresholdCount:
          input.workflowType === SignatureApprovalWorkflowTypes.threshold
            ? input.thresholdCount!
            : null,
        currentStep: 1,
        expiresAt,
        metadataJson: (input.metadata ?? {}) as Prisma.InputJsonValue,
      },
      tx,
    );

    const approvals = await repo.createApprovals(
      steps.map((step) => ({
        workflowId: workflow.id,
        organizationId: input.organizationId,
        reviewerId: step.reviewerId,
        stepOrder: step.stepOrder,
        status: SignatureApprovalStatuses.pending,
      })),
      tx,
    );

    await repo.createApprovalEvent(
      {
        workflowId: workflow.id,
        organizationId: input.organizationId,
        eventType: SignatureApprovalEventTypes.created,
        actorId: userId,
        payloadJson: {
          publicId,
          workflowType: input.workflowType,
          reviewerCount: steps.length,
          thresholdCount: workflow.thresholdCount,
        },
      },
      tx,
    );

    return { workflow, approvals };
  });

  const recipientUserIds = [
    ...new Set([userId, ...steps.map((s) => s.reviewerId)]),
  ];

  await emitDomainNotification({
    organizationId: input.organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.signatureWorkflowCreated,
    entityId: created.workflow.id,
    entityType: "signature_workflow",
    title: "Approval workflow created",
    message: `Workflow ${created.workflow.publicId} requires your review.`,
    metadata: {
      publicId: created.workflow.publicId,
      workflowType: created.workflow.workflowType,
    },
    recipientUserIds,
  });

  // Notify active-step reviewers specifically
  const activeReviewers =
    created.workflow.workflowType === SignatureApprovalWorkflowTypes.sequential
      ? created.approvals.filter((a) => a.stepOrder === 1).map((a) => a.reviewerId)
      : created.approvals.map((a) => a.reviewerId);

  await emitDomainNotification({
    organizationId: input.organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.signatureApprovalRequested,
    entityId: created.workflow.id,
    entityType: "signature_workflow",
    title: "Signature approval requested",
    message: `You have been assigned to review ${created.workflow.publicId}.`,
    metadata: { publicId: created.workflow.publicId },
    recipientUserIds: activeReviewers,
    recipientsOnly: true,
  });

  return {
    workflow: repo.toPublicWorkflow(created.workflow),
    approvals: created.approvals.map(repo.toPublicApproval),
    counts: countApprovalsByStatus(created.approvals),
  };
}

export async function listApprovalWorkflows(
  userId: string,
  organizationId: string,
  query: {
    status?: string;
    signatureId?: string;
    reviewerId?: string;
    limit: number;
    offset: number;
  },
) {
  await assertOrgStaff(userId, organizationId);
  const result = await repo.listWorkflows(organizationId, query);
  return {
    workflows: result.items.map((row) => ({
      ...repo.toPublicWorkflow({
        ...row,
        status: resolveWorkflowStatus(row.status, row.expiresAt),
      }),
      approvals: row.approvals.map(repo.toPublicApproval),
      counts: countApprovalsByStatus(row.approvals),
    })),
    total: result.total,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function getApprovalWorkflow(
  userId: string,
  organizationId: string,
  workflowId: string,
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findWorkflowById(organizationId, workflowId);
  if (!row) throw new AppError(404, "WORKFLOW_NOT_FOUND", "Approval workflow not found");

  const expired = await persistExpiredIfNeeded(row);
  const workflow = expired ?? row;
  const approvals = expired
    ? await repo.listApprovals(workflowId)
    : row.approvals;
  const events = row.events;

  return {
    workflow: repo.toPublicWorkflow({
      ...workflow,
      status: resolveWorkflowStatus(workflow.status, workflow.expiresAt),
    }),
    approvals: approvals.map(repo.toPublicApproval),
    events: events.map(repo.toPublicApprovalEvent),
    counts: countApprovalsByStatus(approvals),
  };
}

export async function approveWorkflowStep(
  userId: string,
  organizationId: string,
  workflowId: string,
  comment?: string,
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findWorkflowById(organizationId, workflowId);
  if (!row) throw new AppError(404, "WORKFLOW_NOT_FOUND", "Approval workflow not found");

  await persistExpiredIfNeeded(row);
  const fresh = (await repo.findWorkflowById(organizationId, workflowId))!;
  const approval = assertReviewerCanAct(fresh, fresh.approvals, userId);

  const progression = evaluateAfterApproval(fresh, fresh.approvals, approval.id);

  const updated = await prisma.$transaction(async (tx) => {
    await repo.updateApproval(
      approval.id,
      {
        status: SignatureApprovalStatuses.approved,
        comment: comment?.trim() || null,
        decidedAt: new Date(),
      },
      tx,
    );

    if (progression.skipApprovalIds.length) {
      await repo.updateApprovalsMany(
        { id: { in: progression.skipApprovalIds } },
        { status: SignatureApprovalStatuses.skipped, decidedAt: new Date() },
        tx,
      );
    }

    const workflowUpdate: Prisma.SignatureWorkflowUpdateInput = {
      status: progression.workflowStatus,
      currentStep: progression.currentStep || fresh.currentStep,
      ...(progression.completed
        ? { completedAt: new Date() }
        : {}),
    };
    const workflow = await repo.updateWorkflow(workflowId, workflowUpdate, tx);

    await repo.createApprovalEvent(
      {
        workflowId,
        organizationId,
        approvalId: approval.id,
        eventType: SignatureApprovalEventTypes.approved,
        actorId: userId,
        payloadJson: { comment: comment?.trim() || null, stepOrder: approval.stepOrder },
      },
      tx,
    );

    if (progression.progressed) {
      await repo.createApprovalEvent(
        {
          workflowId,
          organizationId,
          eventType: SignatureApprovalEventTypes.progressed,
          actorId: userId,
          payloadJson: { currentStep: progression.currentStep },
        },
        tx,
      );
    }

    if (progression.completed) {
      await repo.createApprovalEvent(
        {
          workflowId,
          organizationId,
          eventType: SignatureApprovalEventTypes.completed,
          actorId: userId,
          payloadJson: { status: progression.workflowStatus },
        },
        tx,
      );
    }

    return workflow;
  });

  if (progression.completed) {
    const { signatureProcessMetrics } = await import("./signatures.observability.js");
    const latencyMs = Date.now() - fresh.createdAt.getTime();
    signatureProcessMetrics.recordApproval(latencyMs >= 0 ? latencyMs : undefined);
  }

  const approvals = await repo.listApprovals(workflowId);

  if (progression.progressed) {
    const nextReviewers = approvals
      .filter(
        (a) =>
          a.stepOrder === progression.currentStep &&
          a.status === SignatureApprovalStatuses.pending,
      )
      .map((a) => a.reviewerId);
    if (nextReviewers.length) {
      await emitDomainNotification({
        organizationId,
        actorId: userId,
        eventType: NotificationEventTypes.signatureApprovalRequested,
        entityId: workflowId,
        entityType: "signature_workflow",
        title: "Signature approval requested",
        message: `Workflow ${fresh.publicId} advanced to step ${progression.currentStep}.`,
        metadata: { publicId: fresh.publicId, currentStep: progression.currentStep },
        recipientUserIds: nextReviewers,
        recipientsOnly: true,
      });
    }
  }

  if (progression.completed && progression.workflowStatus === SignatureApprovalWorkflowStatuses.approved) {
    await emitDomainNotification({
      organizationId,
      actorId: userId,
      eventType: NotificationEventTypes.signatureWorkflowApproved,
      entityId: workflowId,
      entityType: "signature_workflow",
      title: "Approval workflow completed",
      message: `Workflow ${fresh.publicId} was approved.`,
      metadata: { publicId: fresh.publicId },
      recipientUserIds: [fresh.createdById, ...approvals.map((a) => a.reviewerId)],
    });
  }

  return {
    workflow: repo.toPublicWorkflow(updated),
    approvals: approvals.map(repo.toPublicApproval),
    counts: countApprovalsByStatus(approvals),
  };
}

export async function rejectWorkflowStep(
  userId: string,
  organizationId: string,
  workflowId: string,
  comment: string,
) {
  await assertOrgStaff(userId, organizationId);
  const row = await repo.findWorkflowById(organizationId, workflowId);
  if (!row) throw new AppError(404, "WORKFLOW_NOT_FOUND", "Approval workflow not found");

  await persistExpiredIfNeeded(row);
  const fresh = (await repo.findWorkflowById(organizationId, workflowId))!;
  const approval = assertReviewerCanAct(fresh, fresh.approvals, userId);
  const progression = evaluateAfterRejection(fresh.approvals, approval.id);

  const updated = await prisma.$transaction(async (tx) => {
    await repo.updateApproval(
      approval.id,
      {
        status: SignatureApprovalStatuses.rejected,
        comment: comment.trim(),
        decidedAt: new Date(),
      },
      tx,
    );
    if (progression.skipApprovalIds.length) {
      await repo.updateApprovalsMany(
        { id: { in: progression.skipApprovalIds } },
        { status: SignatureApprovalStatuses.skipped, decidedAt: new Date() },
        tx,
      );
    }
    const workflow = await repo.updateWorkflow(
      workflowId,
      {
        status: SignatureApprovalWorkflowStatuses.rejected,
        completedAt: new Date(),
      },
      tx,
    );
    await repo.createApprovalEvent(
      {
        workflowId,
        organizationId,
        approvalId: approval.id,
        eventType: SignatureApprovalEventTypes.rejected,
        actorId: userId,
        payloadJson: { comment: comment.trim() },
      },
      tx,
    );
    await repo.createApprovalEvent(
      {
        workflowId,
        organizationId,
        eventType: SignatureApprovalEventTypes.completed,
        actorId: userId,
        payloadJson: { status: SignatureApprovalWorkflowStatuses.rejected },
      },
      tx,
    );
    return workflow;
  });

  const approvals = await repo.listApprovals(workflowId);

  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.signatureWorkflowRejected,
    entityId: workflowId,
    entityType: "signature_workflow",
    title: "Approval workflow rejected",
    message: `Workflow ${fresh.publicId} was rejected.`,
    metadata: { publicId: fresh.publicId, comment },
    recipientUserIds: [fresh.createdById, ...approvals.map((a) => a.reviewerId)],
  });

  return {
    workflow: repo.toPublicWorkflow(updated),
    approvals: approvals.map(repo.toPublicApproval),
    counts: countApprovalsByStatus(approvals),
  };
}

export async function cancelApprovalWorkflow(
  userId: string,
  organizationId: string,
  workflowId: string,
  reason?: string,
) {
  const row = await repo.findWorkflowById(organizationId, workflowId);
  if (!row) throw new AppError(404, "WORKFLOW_NOT_FOUND", "Approval workflow not found");

  const isCreator = row.createdById === userId;
  if (!isCreator) await assertOrgAdmin(userId, organizationId);
  else await assertOrgStaff(userId, organizationId);

  await persistExpiredIfNeeded(row);
  const fresh = (await repo.findWorkflowById(organizationId, workflowId))!;
  const status = resolveWorkflowStatus(fresh.status, fresh.expiresAt);
  if (status !== SignatureApprovalWorkflowStatuses.pending) {
    throw new AppError(400, "WORKFLOW_NOT_PENDING", `Workflow is ${status} and cannot be cancelled`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const workflow = await repo.updateWorkflow(
      workflowId,
      {
        status: SignatureApprovalWorkflowStatuses.cancelled,
        cancelledAt: new Date(),
        cancelledBy: { connect: { id: userId } },
        cancelReason: reason?.trim() || null,
        completedAt: new Date(),
      },
      tx,
    );
    await repo.updateApprovalsMany(
      { workflowId, status: SignatureApprovalStatuses.pending },
      { status: SignatureApprovalStatuses.skipped, decidedAt: new Date() },
      tx,
    );
    await repo.createApprovalEvent(
      {
        workflowId,
        organizationId,
        eventType: SignatureApprovalEventTypes.cancelled,
        actorId: userId,
        payloadJson: { reason: reason?.trim() || null },
      },
      tx,
    );
    return workflow;
  });

  const approvals = await repo.listApprovals(workflowId);

  await emitDomainNotification({
    organizationId,
    actorId: userId,
    eventType: NotificationEventTypes.signatureWorkflowCancelled,
    entityId: workflowId,
    entityType: "signature_workflow",
    title: "Approval workflow cancelled",
    message: `Workflow ${fresh.publicId} was cancelled.`,
    metadata: { publicId: fresh.publicId, reason: reason ?? null },
    recipientUserIds: [fresh.createdById, ...approvals.map((a) => a.reviewerId)],
  });

  return {
    workflow: repo.toPublicWorkflow(updated),
    approvals: approvals.map(repo.toPublicApproval),
    counts: countApprovalsByStatus(approvals),
  };
}
