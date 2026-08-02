/**
 * Persist Phase 2 task ledger rows + artifact lineage (Postgres is source of truth).
 */
import { AiJobStates } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { generateAiPublicCode } from "../utils/ids.js";

export async function createTaskLedgerEntry(input: {
  organizationId: string;
  documentId?: string;
  queueName: string;
  payload: Record<string, unknown>;
  legacyJobPublicCode: string;
  taskPublicCode?: string;
  maxAttempts?: number;
  timeoutMs?: number;
}): Promise<{ id: string; publicCode: string }> {
  const publicCode = input.taskPublicCode ?? generateAiPublicCode("task");
  const queue = await prisma.aiQueue.findUnique({ where: { name: input.queueName } });
  const row = await prisma.aiTask.create({
    data: {
      publicCode,
      organizationId: input.organizationId,
      documentId: input.documentId,
      queueId: queue?.id,
      queueName: input.queueName,
      status: AiJobStates.pending,
      maxAttempts: input.maxAttempts ?? 3,
      timeoutMs: input.timeoutMs ?? 120_000,
      payloadJson: input.payload as Prisma.InputJsonValue,
      legacyJobPublicCode: input.legacyJobPublicCode,
    },
  });
  return { id: row.id, publicCode: row.publicCode };
}

export async function updateTaskLedgerStatus(input: {
  publicCode: string;
  status: string;
  attemptCount?: number;
  error?: string | null;
  resultJson?: unknown;
}): Promise<void> {
  const data: Prisma.AiTaskUpdateManyMutationInput = {
    status: input.status,
    error: input.error ?? undefined,
  };
  if (input.attemptCount != null) data.attemptCount = input.attemptCount;
  if (input.resultJson !== undefined) {
    data.resultJson = input.resultJson as Prisma.InputJsonValue;
  }
  if (
    input.status === AiJobStates.completed ||
    input.status === AiJobStates.failed ||
    input.status === AiJobStates.deadLetter ||
    input.status === AiJobStates.cancelled
  ) {
    data.completedAt = new Date();
  }
  await prisma.aiTask.updateMany({
    where: { publicCode: input.publicCode },
    data,
  });
}

export async function persistArtifactLineage(input: {
  organizationId: string;
  documentId?: string;
  taskPublicCode: string;
  lineage?: Array<Record<string, unknown>>;
}): Promise<string[]> {
  const codes: string[] = [];
  const nodes = input.lineage ?? [];
  let parentId: string | undefined;
  for (const node of nodes) {
    const kind = String(node.kind ?? "artifact");
    const publicCode =
      typeof node.public_code === "string"
        ? node.public_code
        : typeof node.publicCode === "string"
          ? node.publicCode
          : generateAiPublicCode("artifact");
    const created = await prisma.aiArtifact.create({
      data: {
        publicCode,
        organizationId: input.organizationId,
        documentId: input.documentId,
        parentArtifactId: parentId,
        kind,
        taskPublicCode: input.taskPublicCode,
        metaJson: node as Prisma.InputJsonValue,
      },
    });
    codes.push(created.publicCode);
    parentId = created.id;
  }
  if (codes.length > 0) {
    await prisma.aiTask.updateMany({
      where: { publicCode: input.taskPublicCode },
      data: { artifactPublicCode: codes[codes.length - 1] },
    });
  }
  return codes;
}

export async function recordTaskAttempt(input: {
  taskPublicCode: string;
  attemptNumber: number;
  status: string;
  error?: string;
}): Promise<void> {
  const task = await prisma.aiTask.findUnique({ where: { publicCode: input.taskPublicCode } });
  if (!task) return;
  await prisma.aiTaskAttempt.create({
    data: {
      publicCode: generateAiPublicCode("attempt"),
      taskId: task.id,
      attemptNumber: input.attemptNumber,
      status: input.status,
      error: input.error,
      finishedAt:
        input.status === AiJobStates.completed ||
        input.status === AiJobStates.failed ||
        input.status === AiJobStates.deadLetter
          ? new Date()
          : undefined,
    },
  });
}
