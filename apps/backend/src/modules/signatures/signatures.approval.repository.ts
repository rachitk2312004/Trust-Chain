import { prisma, type Prisma } from "@trustchain/database";

export function toPublicWorkflow(row: {
  id: string;
  publicId: string;
  organizationId: string;
  signatureId: string | null;
  createdById: string;
  title: string;
  description: string | null;
  workflowType: string;
  status: string;
  thresholdCount: number | null;
  currentStep: number;
  expiresAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  cancelledById: string | null;
  cancelReason: string | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    publicId: row.publicId,
    organizationId: row.organizationId,
    signatureId: row.signatureId,
    createdById: row.createdById,
    title: row.title,
    description: row.description,
    workflowType: row.workflowType,
    status: row.status,
    thresholdCount: row.thresholdCount,
    currentStep: row.currentStep,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledById: row.cancelledById,
    cancelReason: row.cancelReason,
    metadata: row.metadataJson,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicApproval(row: {
  id: string;
  workflowId: string;
  organizationId: string;
  reviewerId: string;
  stepOrder: number;
  status: string;
  comment: string | null;
  decidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    workflowId: row.workflowId,
    organizationId: row.organizationId,
    reviewerId: row.reviewerId,
    stepOrder: row.stepOrder,
    status: row.status,
    comment: row.comment,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicApprovalEvent(row: {
  id: string;
  workflowId: string;
  approvalId: string | null;
  organizationId: string;
  eventType: string;
  actorId: string | null;
  payloadJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    workflowId: row.workflowId,
    approvalId: row.approvalId,
    organizationId: row.organizationId,
    eventType: row.eventType,
    actorId: row.actorId,
    payload: row.payloadJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createWorkflow(
  data: Prisma.SignatureWorkflowCreateInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signatureWorkflow.create({ data });
}

export async function createApprovals(
  rows: Array<{
    workflowId: string;
    organizationId: string;
    reviewerId: string;
    stepOrder: number;
    status: string;
  }>,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  await db.signatureApproval.createMany({ data: rows });
  return db.signatureApproval.findMany({
    where: { workflowId: rows[0]?.workflowId },
    orderBy: [{ stepOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createApprovalEvent(
  data: {
    workflowId: string;
    organizationId: string;
    eventType: string;
    actorId?: string | null;
    approvalId?: string | null;
    payloadJson?: Prisma.InputJsonValue | null;
  },
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signatureApprovalEvent.create({
    data: {
      workflowId: data.workflowId,
      organizationId: data.organizationId,
      eventType: data.eventType,
      actorId: data.actorId ?? null,
      approvalId: data.approvalId ?? null,
      payloadJson: data.payloadJson ?? undefined,
    },
  });
}

export async function findWorkflowById(organizationId: string, workflowId: string) {
  return prisma.signatureWorkflow.findFirst({
    where: { id: workflowId, organizationId },
    include: {
      approvals: { orderBy: [{ stepOrder: "asc" }, { createdAt: "asc" }] },
      events: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
}

export async function listWorkflows(
  organizationId: string,
  query: {
    status?: string;
    signatureId?: string;
    reviewerId?: string;
    limit: number;
    offset: number;
  },
) {
  const where: Prisma.SignatureWorkflowWhereInput = {
    organizationId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.signatureId ? { signatureId: query.signatureId } : {}),
    ...(query.reviewerId
      ? { approvals: { some: { reviewerId: query.reviewerId } } }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.signatureWorkflow.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
      include: {
        approvals: { orderBy: [{ stepOrder: "asc" }, { createdAt: "asc" }] },
      },
    }),
    prisma.signatureWorkflow.count({ where }),
  ]);
  return { items, total, limit: query.limit, offset: query.offset };
}

export async function updateWorkflow(
  workflowId: string,
  data: Prisma.SignatureWorkflowUpdateInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signatureWorkflow.update({ where: { id: workflowId }, data });
}

export async function updateApproval(
  approvalId: string,
  data: Prisma.SignatureApprovalUpdateInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signatureApproval.update({ where: { id: approvalId }, data });
}

export async function updateApprovalsMany(
  where: Prisma.SignatureApprovalWhereInput,
  data: Prisma.SignatureApprovalUpdateManyMutationInput,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  return db.signatureApproval.updateMany({ where, data });
}

export async function listApprovals(workflowId: string) {
  return prisma.signatureApproval.findMany({
    where: { workflowId },
    orderBy: [{ stepOrder: "asc" }, { createdAt: "asc" }],
  });
}
