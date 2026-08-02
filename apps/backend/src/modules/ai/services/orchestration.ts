/**
 * Gateway orchestration: validate path already done by service → persist task →
 * submit to execution manager (via HTTP) → optional drain → reconcile status.
 */
import { AiJobStates } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { capabilityForKind, mapLegacyToTask, type Wave9JobKind } from "./compatibility.js";
import {
  getAiExecutionClient,
  executionMode,
  type ExecutionStatusResult,
} from "./executionClient.js";
import {
  createTaskLedgerEntry,
  persistArtifactLineage,
  recordTaskAttempt,
  updateTaskLedgerStatus,
} from "./taskLedger.js";

export type OrchestrationAuditWriter = (input: {
  organizationId: string;
  actorUserId: string;
  jobPublicCode: string;
  action: string;
  success?: boolean;
  payload?: unknown;
}) => Promise<void>;

export async function submitAiExecution(input: {
  kind: Wave9JobKind;
  organizationId: string;
  documentId?: string;
  actorUserId: string;
  legacyJobPublicCode: string;
  payload: Record<string, unknown>;
  writeAudit: OrchestrationAuditWriter;
  drain?: boolean;
}): Promise<{
  taskPublicCode: string;
  queueName: string;
  status: string;
  result: Record<string, unknown> | null;
  mapping: ReturnType<typeof mapLegacyToTask>;
}> {
  const queueName = capabilityForKind(input.kind);
  const ledger = await createTaskLedgerEntry({
    organizationId: input.organizationId,
    documentId: input.documentId,
    queueName,
    payload: input.payload,
    legacyJobPublicCode: input.legacyJobPublicCode,
  });

  const mapping = mapLegacyToTask({
    legacyJobPublicCode: input.legacyJobPublicCode,
    taskPublicCode: ledger.publicCode,
    kind: input.kind,
  });

  await input.writeAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    jobPublicCode: input.legacyJobPublicCode,
    action: "ai.execution.submit",
    payload: { ...mapping, mode: executionMode() },
  });

  const client = getAiExecutionClient();
  const submitted = await client.submit({
    capability: queueName,
    payload: input.payload,
    organizationId: input.organizationId,
    documentId: input.documentId,
    legacyJobPublicCode: input.legacyJobPublicCode,
    taskId: ledger.publicCode,
  });

  await updateTaskLedgerStatus({
    publicCode: ledger.publicCode,
    status: AiJobStates.processing,
    attemptCount: 1,
  });
  await recordTaskAttempt({
    taskPublicCode: ledger.publicCode,
    attemptNumber: 1,
    status: AiJobStates.processing,
  });
  await input.writeAudit({
    organizationId: input.organizationId,
    actorUserId: input.actorUserId,
    jobPublicCode: input.legacyJobPublicCode,
    action: "ai.execution.state.processing",
    payload: { taskPublicCode: ledger.publicCode },
  });

  const shouldDrain = input.drain ?? process.env.AI_EXECUTION_DRAIN !== "false";
  if (shouldDrain) {
    await client.drain([queueName]);
  }

  let status = await client.status(submitted.taskId);
  status = await reconcileTaskStatus(status, {
    organizationId: input.organizationId,
    documentId: input.documentId,
    actorUserId: input.actorUserId,
    legacyJobPublicCode: input.legacyJobPublicCode,
    taskPublicCode: ledger.publicCode,
    writeAudit: input.writeAudit,
  });

  const result =
    status.result && typeof status.result === "object"
      ? (status.result as Record<string, unknown>)
      : status.status === "completed"
        ? { advisoryOnly: true }
        : null;

  return {
    taskPublicCode: ledger.publicCode,
    queueName,
    status: status.status,
    result,
    mapping,
  };
}

async function reconcileTaskStatus(
  status: ExecutionStatusResult,
  ctx: {
    organizationId: string;
    documentId?: string;
    actorUserId: string;
    legacyJobPublicCode: string;
    taskPublicCode: string;
    writeAudit: OrchestrationAuditWriter;
  },
): Promise<ExecutionStatusResult> {
  const normalized = status.status || "unknown";
  await updateTaskLedgerStatus({
    publicCode: ctx.taskPublicCode,
    status: normalized,
    attemptCount: status.attempt ? Number(status.attempt) : undefined,
    error: status.error ?? null,
    resultJson: status.result ?? undefined,
  });

  if (normalized === AiJobStates.retrying) {
    await ctx.writeAudit({
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      jobPublicCode: ctx.legacyJobPublicCode,
      action: "ai.execution.retry",
      success: false,
      payload: { taskPublicCode: ctx.taskPublicCode, error: status.error },
    });
  } else if (normalized === AiJobStates.deadLetter) {
    await ctx.writeAudit({
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      jobPublicCode: ctx.legacyJobPublicCode,
      action: "ai.execution.dead_letter",
      success: false,
      payload: { taskPublicCode: ctx.taskPublicCode, error: status.error },
    });
  } else if (normalized === AiJobStates.failed) {
    await ctx.writeAudit({
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      jobPublicCode: ctx.legacyJobPublicCode,
      action: "ai.execution.failed",
      success: false,
      payload: { taskPublicCode: ctx.taskPublicCode, error: status.error },
    });
  } else if (normalized === AiJobStates.cancelled) {
    await ctx.writeAudit({
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      jobPublicCode: ctx.legacyJobPublicCode,
      action: "ai.execution.cancelled",
      payload: { taskPublicCode: ctx.taskPublicCode },
    });
  } else if (normalized === AiJobStates.completed) {
    const lineage = extractLineage(status.result);
    if (lineage.length > 0) {
      await persistArtifactLineage({
        organizationId: ctx.organizationId,
        documentId: ctx.documentId,
        taskPublicCode: ctx.taskPublicCode,
        lineage,
      });
    }
    await ctx.writeAudit({
      organizationId: ctx.organizationId,
      actorUserId: ctx.actorUserId,
      jobPublicCode: ctx.legacyJobPublicCode,
      action: "ai.execution.completed",
      payload: { taskPublicCode: ctx.taskPublicCode },
    });
  }

  return status;
}

function extractLineage(result: unknown): Array<Record<string, unknown>> {
  if (!result || typeof result !== "object") return [];
  const lineage = (result as { lineage?: unknown }).lineage;
  return Array.isArray(lineage) ? (lineage as Array<Record<string, unknown>>) : [];
}

export async function findTaskByLegacyCode(legacyJobPublicCode: string) {
  return prisma.aiTask.findFirst({
    where: { legacyJobPublicCode },
    orderBy: { createdAt: "desc" },
  });
}
