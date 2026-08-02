import { createHash } from "node:crypto";
import {
  AiJobStates,
  AiModelProviders,
  AiReviewStates,
  DocumentPermissions,
  OcrEngines,
  RoleKeys,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../../lib/errors.js";
import { userHasRole } from "../../auth/rbac.repository.js";
import {
  assertDocumentPermission,
  type DocumentAccessContext,
} from "../../documents/documents.access.js";
import { aiAnalyticsInc } from "./analytics.js";
import { advisoryResultMeta, cosineSimilarity, metaFromExecutionResult } from "./processor.js";
import { submitAiExecution, findTaskByLegacyCode } from "./orchestration.js";
import { AI_ADVISORY_DISCLAIMER, assertSafeAiOperation } from "../utils/guards.js";
import { generateAiPublicCode } from "../utils/ids.js";
import { assertAiRateLimit } from "../utils/rateLimit.js";

type JobKind = "ocr" | "extract" | "classify" | "search" | "fraud" | "embed";

async function assertOrgMember(userId: string, organizationId: string): Promise<void> {
  const allowed = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!allowed) {
    throw new AppError(403, "FORBIDDEN", "Organization membership required");
  }
}

function toAccessContext(doc: {
  id: string;
  organizationId: string;
  createdById: string;
  status: string;
  deletedAt: Date | null;
  expiresAt: Date | null;
  archivedAt: Date | null;
}): DocumentAccessContext {
  return {
    id: doc.id,
    organizationId: doc.organizationId,
    createdById: doc.createdById,
    status: doc.status,
    deletedAt: doc.deletedAt,
    expiresAt: doc.expiresAt,
    archivedAt: doc.archivedAt,
  };
}

async function loadDocument(organizationId: string, documentId: string) {
  const doc = await prisma.document.findFirst({
    where: { id: documentId, organizationId },
  });
  if (!doc) throw new AppError(404, "DOC_NOT_FOUND", "Document not found");
  return doc;
}

async function writeAiAudit(input: {
  organizationId: string;
  actorUserId: string;
  jobPublicCode: string;
  action: string;
  success?: boolean;
  payload?: unknown;
}): Promise<void> {
  const hash = input.payload
    ? createHash("sha256").update(JSON.stringify(input.payload)).digest("hex")
    : null;
  await prisma.aiAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      actorUserId: input.actorUserId,
      jobPublicCode: input.jobPublicCode,
      action: input.action,
      success: input.success ?? true,
      inputHash: hash,
      metaJson: { disclaimer: AI_ADVISORY_DISCLAIMER } as Prisma.InputJsonValue,
    },
  });
}

async function ensureLineage(organizationId: string, documentId: string) {
  const existing = await prisma.aiLineage.findFirst({
    where: { organizationId, documentId },
    orderBy: { createdAt: "desc" },
  });
  if (existing) return existing;
  return prisma.aiLineage.create({
    data: {
      publicCode: generateAiPublicCode("lineage"),
      organizationId,
      documentId,
      stepsJson: [{ step: "document", at: new Date().toISOString() }],
    },
  });
}

async function appendLineageStep(lineageId: string, step: string, ref?: string): Promise<void> {
  const lineage = await prisma.aiLineage.findUnique({ where: { id: lineageId } });
  if (!lineage) return;
  const steps = Array.isArray(lineage.stepsJson) ? [...(lineage.stepsJson as unknown[])] : [];
  steps.push({ step, ref, at: new Date().toISOString() });
  await prisma.aiLineage.update({
    where: { id: lineageId },
    data: { stepsJson: steps as Prisma.InputJsonValue },
  });
}

function requireExecutionResult(
  executed: { status: string; result: Record<string, unknown> | null; taskPublicCode: string },
  label: string,
): Record<string, unknown> {
  if (executed.status !== AiJobStates.completed || !executed.result) {
    throw new Error(`${label}_execution_${executed.status}`);
  }
  return executed.result;
}

async function latestOcrText(organizationId: string, documentId: string): Promise<string> {
  const job = await prisma.ocrJob.findFirst({
    where: { organizationId, documentId, status: AiJobStates.completed },
    orderBy: { completedAt: "desc" },
    include: { result: true },
  });
  if (job?.result?.text) return job.result.text;
  throw new AppError(
    409,
    "AI_OCR_REQUIRED",
    "Completed OCR text is required before this AI operation",
  );
}

function publicJob(row: {
  publicCode: string;
  status: string;
  reviewStatus: string;
  kind?: string;
  confidence?: number | null;
  confidenceLow?: number | null;
  confidenceHigh?: number | null;
  modelVersion?: string | null;
  evaluationVersion?: string | null;
  tokenUsage?: number;
  computeUsageMs?: number;
  storageUsageBytes?: number;
  estimatedCostUsd?: number;
  resultJson?: unknown;
  explanationJson?: unknown;
  error?: string | null;
  createdAt: Date;
  completedAt?: Date | null;
  lineageId?: string | null;
}) {
  return {
    publicCode: row.publicCode,
    status: row.status,
    reviewStatus: row.reviewStatus,
    kind: row.kind,
    confidence: row.confidence,
    confidenceInterval:
      row.confidenceLow != null && row.confidenceHigh != null
        ? { low: row.confidenceLow, high: row.confidenceHigh }
        : null,
    modelVersion: row.modelVersion,
    evaluationVersion: row.evaluationVersion,
    tokenUsage: row.tokenUsage ?? 0,
    computeUsage: row.computeUsageMs ?? 0,
    storageUsage: row.storageUsageBytes ?? 0,
    estimatedCost: row.estimatedCostUsd ?? 0,
    result: row.resultJson ?? null,
    explanation: row.explanationJson ?? null,
    error: row.error ?? null,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    lineageId: row.lineageId ?? null,
    advisoryOnly: true,
    disclaimer: AI_ADVISORY_DISCLAIMER,
  };
}

async function createParentAiJob(input: {
  userId: string;
  organizationId: string;
  documentId: string;
  documentVersionId?: string;
  kind: JobKind;
  lineageId: string;
}) {
  const meta = advisoryResultMeta(input.kind);
  return prisma.aiJob.create({
    data: {
      publicCode: generateAiPublicCode("aiJob"),
      organizationId: input.organizationId,
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      createdByUserId: input.userId,
      kind: input.kind,
      status: AiJobStates.pending,
      reviewStatus: AiReviewStates.pendingReview,
      lineageId: input.lineageId,
      modelProvider: meta.modelProvider,
      modelVersion: meta.confidence.modelVersion,
      evaluationVersion: meta.confidence.evaluationVersion,
    },
  });
}

export async function createOcrJob(
  userId: string,
  organizationId: string,
  input: { documentId: string; documentVersionId?: string; engine?: string },
) {
  assertSafeAiOperation("ocr");
  assertAiRateLimit(`${userId}:${organizationId}:ocr`);
  await assertOrgMember(userId, organizationId);
  const doc = await loadDocument(organizationId, input.documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);

  const lineage = await ensureLineage(organizationId, doc.id);
  const parent = await createParentAiJob({
    userId,
    organizationId,
    documentId: doc.id,
    documentVersionId: input.documentVersionId ?? doc.currentVersionId ?? undefined,
    kind: "ocr",
    lineageId: lineage.id,
  });

  const engine =
    input.engine && (Object.values(OcrEngines) as string[]).includes(input.engine)
      ? input.engine
      : OcrEngines.auto;

  const ocrJob = await prisma.ocrJob.create({
    data: {
      publicCode: generateAiPublicCode("ocrJob"),
      organizationId,
      documentId: doc.id,
      documentVersionId: input.documentVersionId ?? doc.currentVersionId ?? undefined,
      aiJobId: parent.id,
      lineageId: lineage.id,
      // auto resolves to stub OCR engine only inside FastAPI adapters (CI/local).
      engine: engine === OcrEngines.auto ? OcrEngines.stub : engine,
      status: AiJobStates.pending,
      reviewStatus: AiReviewStates.pendingReview,
    },
  });

  await prisma.aiHumanReview.create({
    data: { aiJobId: parent.id, status: AiReviewStates.pendingReview },
  });
  await writeAiAudit({
    organizationId,
    actorUserId: userId,
    jobPublicCode: ocrJob.publicCode,
    action: "ai.ocr.create",
    payload: input,
  });
  aiAnalyticsInc("jobsCreated");
  aiAnalyticsInc("ocr");

  await completeOcrJob({
    ocrJobId: ocrJob.id,
    aiJobId: parent.id,
    lineageId: lineage.id,
    documentId: doc.id,
    organizationId,
    userId,
    legacyJobPublicCode: ocrJob.publicCode,
    engine: ocrJob.engine,
  });

  const refreshed = await prisma.aiJob.findUniqueOrThrow({ where: { id: parent.id } });
  const refreshedOcr = await prisma.ocrJob.findUniqueOrThrow({ where: { id: ocrJob.id } });

  return {
    job: publicJob({ ...refreshed, kind: "ocr" }),
    ocrJob: {
      publicCode: refreshedOcr.publicCode,
      status: refreshedOcr.status,
      engine: refreshedOcr.engine,
    },
    lineage: { publicCode: lineage.publicCode },
  };
}

async function completeOcrJob(input: {
  ocrJobId: string;
  aiJobId: string;
  lineageId: string;
  documentId: string;
  organizationId: string;
  userId: string;
  legacyJobPublicCode: string;
  engine: string;
}): Promise<void> {
  await prisma.ocrJob.update({
    where: { id: input.ocrJobId },
    data: { status: AiJobStates.processing },
  });
  await prisma.aiJob.update({
    where: { id: input.aiJobId },
    data: { status: AiJobStates.processing },
  });

  try {
    const executed = await submitAiExecution({
      kind: "ocr",
      organizationId: input.organizationId,
      documentId: input.documentId,
      actorUserId: input.userId,
      legacyJobPublicCode: input.legacyJobPublicCode,
      payload: {
        documentId: input.documentId,
        engine: input.engine,
        imageData: input.documentId,
      },
      writeAudit: writeAiAudit,
    });

    const result = requireExecutionResult(executed, "ocr");
    const ocrText = typeof result.text === "string" ? result.text : "";
    if (!ocrText) {
      throw new Error("ocr_empty_text");
    }
    const meta = metaFromExecutionResult("ocr", result);
    await prisma.ocrResult.create({
      data: {
        ocrJobId: input.ocrJobId,
        text: ocrText,
        language: "en",
        handwritingLikely: false,
        layoutJson: { pages: 1, blocks: 1, taskPublicCode: executed.taskPublicCode },
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await prisma.ocrJob.update({
      where: { id: input.ocrJobId },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
      },
    });
    await prisma.aiJob.update({
      where: { id: input.aiJobId },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
        resultJson: {
          text: ocrText,
          language: typeof result.language === "string" ? result.language : "en",
          handwritingLikely: Boolean(result.handwritingLikely),
          taskPublicCode: executed.taskPublicCode,
          mapping: executed.mapping,
          modelId: typeof result.modelId === "string" ? result.modelId : null,
          modelVersion:
            typeof result.modelVersion === "string" ? result.modelVersion : null,
          lineageId:
            typeof result.lineageId === "string"
              ? result.lineageId
              : typeof result.lineage === "string"
                ? result.lineage
                : null,
          executionTimeMs:
            typeof result.executionTimeMs === "number" ? result.executionTimeMs : null,
          confidence: typeof result.confidence === "number" ? result.confidence : null,
        },
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await appendLineageStep(input.lineageId, "ocr_result", input.ocrJobId);
    aiAnalyticsInc("jobsCompleted");
    aiAnalyticsInc("tokenUsage", meta.cost.tokenUsage);
    aiAnalyticsInc("estimatedCostUsd", meta.cost.estimatedCost);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ocr_failed";
    await prisma.ocrJob.update({
      where: { id: input.ocrJobId },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await prisma.aiJob.update({
      where: { id: input.aiJobId },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await writeAiAudit({
      organizationId: input.organizationId,
      actorUserId: input.userId,
      jobPublicCode: input.legacyJobPublicCode,
      action: "ai.ocr.failed",
      success: false,
      payload: { error: message },
    });
    aiAnalyticsInc("jobsFailed");
  }
}

export async function createExtractJob(
  userId: string,
  organizationId: string,
  input: { documentId: string },
) {
  assertSafeAiOperation("extract");
  assertAiRateLimit(`${userId}:${organizationId}:extract`);
  await assertOrgMember(userId, organizationId);
  const doc = await loadDocument(organizationId, input.documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);
  const lineage = await ensureLineage(organizationId, doc.id);
  const parent = await createParentAiJob({
    userId,
    organizationId,
    documentId: doc.id,
    kind: "extract",
    lineageId: lineage.id,
  });
  await prisma.aiHumanReview.create({
    data: { aiJobId: parent.id, status: AiReviewStates.pendingReview },
  });
  await writeAiAudit({
    organizationId,
    actorUserId: userId,
    jobPublicCode: parent.publicCode,
    action: "ai.extract.create",
    payload: input,
  });
  aiAnalyticsInc("jobsCreated");
  aiAnalyticsInc("extract");

  await prisma.aiJob.update({
    where: { id: parent.id },
    data: { status: AiJobStates.processing },
  });
  try {
    const text = await latestOcrText(organizationId, doc.id);
    const executed = await submitAiExecution({
      kind: "extract",
      organizationId,
      documentId: doc.id,
      actorUserId: userId,
      legacyJobPublicCode: parent.publicCode,
      payload: { text, documentId: doc.id },
      writeAudit: writeAiAudit,
    });
    const entities = requireExecutionResult(executed, "extract");
    const meta = metaFromExecutionResult("extract", entities);
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
        resultJson: {
          ...entities,
          taskPublicCode: executed.taskPublicCode,
          mapping: executed.mapping,
        } as Prisma.InputJsonValue,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await appendLineageStep(lineage.id, "extraction_result", parent.publicCode);
    aiAnalyticsInc("jobsCompleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "extract_failed";
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await writeAiAudit({
      organizationId,
      actorUserId: userId,
      jobPublicCode: parent.publicCode,
      action: "ai.extract.failed",
      success: false,
      payload: { error: message },
    });
    aiAnalyticsInc("jobsFailed");
  }

  const refreshed = await prisma.aiJob.findUniqueOrThrow({ where: { id: parent.id } });
  return {
    job: publicJob({ ...refreshed, kind: "extract" }),
    lineage: { publicCode: lineage.publicCode },
  };
}

export async function createClassifyJob(
  userId: string,
  organizationId: string,
  input: { documentId: string },
) {
  assertSafeAiOperation("classify");
  assertAiRateLimit(`${userId}:${organizationId}:classify`);
  await assertOrgMember(userId, organizationId);
  const doc = await loadDocument(organizationId, input.documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);
  const lineage = await ensureLineage(organizationId, doc.id);
  const parent = await createParentAiJob({
    userId,
    organizationId,
    documentId: doc.id,
    kind: "classify",
    lineageId: lineage.id,
  });
  const classifyJob = await prisma.classificationJob.create({
    data: {
      publicCode: generateAiPublicCode("classificationJob"),
      organizationId,
      documentId: doc.id,
      lineageId: lineage.id,
      status: AiJobStates.pending,
      reviewStatus: AiReviewStates.pendingReview,
      modelProvider: AiModelProviders.local,
    },
  });
  await prisma.aiHumanReview.create({
    data: { aiJobId: parent.id, status: AiReviewStates.pendingReview },
  });
  await writeAiAudit({
    organizationId,
    actorUserId: userId,
    jobPublicCode: parent.publicCode,
    action: "ai.classify.create",
    payload: input,
  });
  aiAnalyticsInc("jobsCreated");
  aiAnalyticsInc("classify");

  await prisma.classificationJob.update({
    where: { id: classifyJob.id },
    data: { status: AiJobStates.processing },
  });
  await prisma.aiJob.update({
    where: { id: parent.id },
    data: { status: AiJobStates.processing },
  });
  try {
    const text = await latestOcrText(organizationId, doc.id);
    const executed = await submitAiExecution({
      kind: "classify",
      organizationId,
      documentId: doc.id,
      actorUserId: userId,
      legacyJobPublicCode: classifyJob.publicCode,
      payload: { text, documentId: doc.id },
      writeAudit: writeAiAudit,
    });
    const result = requireExecutionResult(executed, "classify");
    const label = typeof result.label === "string" ? result.label : "unknown";
    const classified = {
      label,
      scoresJson:
        (result.scoresJson as Record<string, number> | undefined) ??
        ({ [label]: typeof result.confidence === "number" ? result.confidence : 0.7 } as Record<
          string,
          number
        >),
    };
    const meta = metaFromExecutionResult("classify", result);
    await prisma.classificationResult.create({
      data: {
        classificationJobId: classifyJob.id,
        label: classified.label,
        scoresJson: classified.scoresJson,
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await prisma.classificationJob.update({
      where: { id: classifyJob.id },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
      },
    });
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
        resultJson: {
          ...classified,
          taskPublicCode: executed.taskPublicCode,
          mapping: executed.mapping,
        } as Prisma.InputJsonValue,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await appendLineageStep(lineage.id, "classification_result", classifyJob.publicCode);
    aiAnalyticsInc("jobsCompleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "classify_failed";
    await prisma.classificationJob.update({
      where: { id: classifyJob.id },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await writeAiAudit({
      organizationId,
      actorUserId: userId,
      jobPublicCode: parent.publicCode,
      action: "ai.classify.failed",
      success: false,
      payload: { error: message },
    });
    aiAnalyticsInc("jobsFailed");
  }

  const refreshed = await prisma.aiJob.findUniqueOrThrow({ where: { id: parent.id } });
  const refreshedClassify = await prisma.classificationJob.findUniqueOrThrow({
    where: { id: classifyJob.id },
  });
  return {
    job: publicJob({ ...refreshed, kind: "classify" }),
    classificationJob: {
      publicCode: refreshedClassify.publicCode,
      status: refreshedClassify.status,
    },
    lineage: { publicCode: lineage.publicCode },
  };
}

export async function createSearchJob(
  userId: string,
  organizationId: string,
  input: { documentId?: string; query: string; limit?: number },
) {
  assertSafeAiOperation("search");
  assertAiRateLimit(`${userId}:${organizationId}:search`);
  await assertOrgMember(userId, organizationId);

  let lineagePublicCode: string | null = null;
  let parentId: string | null = null;
  let parentCode: string | null = null;

  if (input.documentId) {
    const doc = await loadDocument(organizationId, input.documentId);
    await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);
    const lineage = await ensureLineage(organizationId, doc.id);
    lineagePublicCode = lineage.publicCode;
    const parent = await createParentAiJob({
      userId,
      organizationId,
      documentId: doc.id,
      kind: "search",
      lineageId: lineage.id,
    });
    parentId = parent.id;
    parentCode = parent.publicCode;
    await prisma.aiHumanReview.create({
      data: { aiJobId: parent.id, status: AiReviewStates.pendingReview },
    });

    const text = await latestOcrText(organizationId, doc.id);
    const executed = await submitAiExecution({
      kind: "search",
      organizationId,
      documentId: doc.id,
      actorUserId: userId,
      legacyJobPublicCode: parent.publicCode,
      payload: { text, documentId: doc.id, query: input.query },
      writeAudit: writeAiAudit,
    });
    const embedResult = requireExecutionResult(executed, "embedding");
    const chunkTexts = Array.isArray(embedResult.chunks)
      ? (embedResult.chunks as string[])
      : [];
    const vectors = Array.isArray(embedResult.embeddings)
      ? (embedResult.embeddings as number[][])
      : [];
    if (chunkTexts.length === 0 || vectors.length === 0) {
      throw new AppError(502, "AI_EXECUTION_ERROR", "Embedding execution returned no vectors");
    }
    const chunks = chunkTexts.map((chunkText, chunkIndex) => ({
      chunkIndex,
      chunkText,
      embedding: vectors[chunkIndex] ?? vectors[0]!,
    }));
    const modelVersion =
      typeof embedResult.modelVersion === "string"
        ? embedResult.modelVersion
        : "MODEL-VERSION-EMBED001";
    const embedJob = await prisma.embeddingJob.create({
      data: {
        publicCode: generateAiPublicCode("embeddingJob"),
        organizationId,
        documentId: doc.id,
        lineageId: lineage.id,
        status: AiJobStates.completed,
        reviewStatus: AiReviewStates.pendingReview,
        modelProvider:
          typeof embedResult.provider === "string"
            ? embedResult.provider
            : AiModelProviders.local,
        modelVersion,
        evaluationVersion:
          typeof embedResult.evaluationVersion === "string"
            ? embedResult.evaluationVersion
            : "eval-1.0.0",
        confidence: typeof embedResult.confidence === "number" ? embedResult.confidence : 0.8,
        confidenceLow: 0.7,
        confidenceHigh: 0.9,
        chunkCount: chunks.length,
        completedAt: new Date(),
      },
    });
    await prisma.documentEmbedding.deleteMany({ where: { organizationId, documentId: doc.id } });
    await prisma.documentEmbedding.createMany({
      data: chunks.map((c) => ({
        organizationId,
        documentId: doc.id,
        chunkIndex: c.chunkIndex,
        chunkText: c.chunkText,
        embeddingJson: c.embedding,
        modelVersion,
      })),
    });
    await appendLineageStep(lineage.id, "embedding_result", embedJob.publicCode);
  }

  const queryEmbed = await submitAiExecution({
    kind: "embed",
    organizationId,
    documentId: input.documentId,
    actorUserId: userId,
    legacyJobPublicCode: parentCode ?? generateAiPublicCode("aiJob"),
    payload: { text: input.query },
    writeAudit: writeAiAudit,
  });
  const queryResult = requireExecutionResult(queryEmbed, "embed");
  const queryVectors = Array.isArray(queryResult.embeddings)
    ? (queryResult.embeddings as number[][])
    : [];
  if (!queryVectors[0]) {
    throw new AppError(502, "AI_EXECUTION_ERROR", "Query embedding execution returned no vector");
  }
  const queryVec = queryVectors[0];
  const embeddings = await prisma.documentEmbedding.findMany({
    where: { organizationId },
    take: 500,
  });
  const ranked = embeddings
    .map((row) => {
      const vec = row.embeddingJson as number[];
      return {
        documentId: row.documentId,
        chunkIndex: row.chunkIndex,
        chunkText: row.chunkText,
        score: cosineSimilarity(queryVec, Array.isArray(vec) ? vec : []),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.min(input.limit ?? 10, 50));

  const meta = metaFromExecutionResult("search", queryResult);
  const result = {
    query: input.query,
    matches: ranked,
    confidence: meta.confidence.confidence,
    confidenceInterval: meta.confidence.confidenceInterval,
    modelVersion: meta.confidence.modelVersion,
    evaluationVersion: meta.confidence.evaluationVersion,
    tokenUsage: meta.cost.tokenUsage,
    computeUsage: meta.cost.computeUsage,
    storageUsage: meta.cost.storageUsage,
    estimatedCost: meta.cost.estimatedCost,
    explanation: meta.explanation,
    advisoryOnly: true,
    disclaimer: AI_ADVISORY_DISCLAIMER,
    taskPublicCode: queryEmbed.taskPublicCode,
    modelId: typeof queryResult.modelId === "string" ? queryResult.modelId : undefined,
    lineageId: typeof queryResult.lineageId === "string" ? queryResult.lineageId : undefined,
    executionTimeMs:
      typeof queryResult.executionTimeMs === "number" ? queryResult.executionTimeMs : undefined,
  };

  if (parentId && parentCode) {
    await prisma.aiJob.update({
      where: { id: parentId },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
        resultJson: result as Prisma.InputJsonValue,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await writeAiAudit({
      organizationId,
      actorUserId: userId,
      jobPublicCode: parentCode,
      action: "ai.search.complete",
      payload: { query: input.query, matchCount: ranked.length },
    });
  }

  aiAnalyticsInc("search");
  aiAnalyticsInc("jobsCompleted");

  return {
    job: parentCode
      ? {
          publicCode: parentCode,
          status: AiJobStates.completed,
          kind: "search",
          reviewStatus: AiReviewStates.pendingReview,
          advisoryOnly: true,
          disclaimer: AI_ADVISORY_DISCLAIMER,
        }
      : null,
    lineage: lineagePublicCode ? { publicCode: lineagePublicCode } : null,
    result,
  };
}

export async function createFraudJob(
  userId: string,
  organizationId: string,
  input: { documentId: string },
) {
  assertSafeAiOperation("fraud");
  assertAiRateLimit(`${userId}:${organizationId}:fraud`);
  await assertOrgMember(userId, organizationId);
  const doc = await loadDocument(organizationId, input.documentId);
  await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);
  const lineage = await ensureLineage(organizationId, doc.id);
  const parent = await createParentAiJob({
    userId,
    organizationId,
    documentId: doc.id,
    kind: "fraud",
    lineageId: lineage.id,
  });
  const fraudJob = await prisma.fraudAnalysisJob.create({
    data: {
      publicCode: generateAiPublicCode("aiJob"),
      organizationId,
      documentId: doc.id,
      lineageId: lineage.id,
      status: AiJobStates.pending,
      reviewStatus: AiReviewStates.pendingReview,
      advisoryOnly: true,
      modelProvider: AiModelProviders.local,
    },
  });
  await prisma.aiHumanReview.create({
    data: { aiJobId: parent.id, status: AiReviewStates.pendingReview },
  });
  await writeAiAudit({
    organizationId,
    actorUserId: userId,
    jobPublicCode: parent.publicCode,
    action: "ai.fraud.create",
    payload: input,
  });
  aiAnalyticsInc("jobsCreated");
  aiAnalyticsInc("fraud");

  await prisma.fraudAnalysisJob.update({
    where: { id: fraudJob.id },
    data: { status: AiJobStates.processing },
  });
  await prisma.aiJob.update({
    where: { id: parent.id },
    data: { status: AiJobStates.processing },
  });
  try {
    const text = await latestOcrText(organizationId, doc.id);
    const executed = await submitAiExecution({
      kind: "fraud",
      organizationId,
      documentId: doc.id,
      actorUserId: userId,
      legacyJobPublicCode: fraudJob.publicCode,
      payload: { text, documentId: doc.id },
      writeAudit: writeAiAudit,
    });
    const executedResult = requireExecutionResult(executed, "fraud");
    const fraud = {
      riskScore:
        typeof executedResult.riskScore === "number" ? executedResult.riskScore : 0,
      signalsJson: (executedResult.signalsJson as Record<string, unknown>) ?? {},
    };
    const meta = metaFromExecutionResult("fraud", executedResult);
    const result = {
      ...fraud,
      taskPublicCode: executed.taskPublicCode,
      mapping: executed.mapping,
      modelId: typeof executedResult.modelId === "string" ? executedResult.modelId : undefined,
      modelVersion:
        typeof executedResult.modelVersion === "string"
          ? executedResult.modelVersion
          : undefined,
      lineageId:
        typeof executedResult.lineageId === "string" ? executedResult.lineageId : undefined,
      executionTimeMs:
        typeof executedResult.executionTimeMs === "number"
          ? executedResult.executionTimeMs
          : undefined,
      confidence:
        typeof executedResult.confidence === "number" ? executedResult.confidence : undefined,
      advisoryOnly: true,
      neverMutatesVerification: true,
      disclaimer: AI_ADVISORY_DISCLAIMER,
    };
    await prisma.fraudAnalysisJob.update({
      where: { id: fraudJob.id },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        riskScore: fraud.riskScore,
        signalsJson: fraud.signalsJson as Prisma.InputJsonValue,
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
        advisoryOnly: true,
      },
    });
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: {
        status: AiJobStates.completed,
        completedAt: new Date(),
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        tokenUsage: meta.cost.tokenUsage,
        computeUsageMs: meta.cost.computeUsage,
        storageUsageBytes: meta.cost.storageUsage,
        estimatedCostUsd: meta.cost.estimatedCost,
        resultJson: result as Prisma.InputJsonValue,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await appendLineageStep(lineage.id, "fraud_analysis", fraudJob.publicCode);
    aiAnalyticsInc("jobsCompleted");
  } catch (error) {
    const message = error instanceof Error ? error.message : "fraud_failed";
    await prisma.fraudAnalysisJob.update({
      where: { id: fraudJob.id },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await writeAiAudit({
      organizationId,
      actorUserId: userId,
      jobPublicCode: parent.publicCode,
      action: "ai.fraud.failed",
      success: false,
      payload: { error: message },
    });
    aiAnalyticsInc("jobsFailed");
  }

  const refreshed = await prisma.aiJob.findUniqueOrThrow({ where: { id: parent.id } });
  const refreshedFraud = await prisma.fraudAnalysisJob.findUniqueOrThrow({
    where: { id: fraudJob.id },
  });
  return {
    job: publicJob({ ...refreshed, kind: "fraud" }),
    fraudJob: {
      publicCode: refreshedFraud.publicCode,
      status: refreshedFraud.status,
      advisoryOnly: true,
    },
    lineage: { publicCode: lineage.publicCode },
  };
}

export async function getAiJob(userId: string, organizationId: string, jobId: string) {
  await assertOrgMember(userId, organizationId);
  assertAiRateLimit(`${userId}:${organizationId}:job`);

  const aiJob = await prisma.aiJob.findFirst({
    where: {
      organizationId,
      OR: [{ publicCode: jobId }, { id: jobId }],
    },
    include: { humanReviews: { orderBy: { createdAt: "desc" }, take: 5 }, lineage: true },
  });
  if (aiJob) {
    if (aiJob.documentId) {
      const doc = await loadDocument(organizationId, aiJob.documentId);
      await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);
    }
    const task = await findTaskByLegacyCode(aiJob.publicCode);
    return {
      job: publicJob({ ...aiJob, kind: aiJob.kind }),
      task: task
        ? {
            publicCode: task.publicCode,
            status: task.status,
            queueName: task.queueName,
            attemptCount: task.attemptCount,
            legacyJobPublicCode: task.legacyJobPublicCode,
            artifactPublicCode: task.artifactPublicCode,
          }
        : null,
      reviews: aiJob.humanReviews.map((r) => ({
        status: r.status,
        notes: r.notes,
        decidedAt: r.decidedAt?.toISOString() ?? null,
      })),
      lineage: aiJob.lineage
        ? { publicCode: aiJob.lineage.publicCode, steps: aiJob.lineage.stepsJson }
        : null,
    };
  }

  const ocrJob = await prisma.ocrJob.findFirst({
    where: { organizationId, OR: [{ publicCode: jobId }, { id: jobId }] },
    include: { result: true, lineage: true },
  });
  if (ocrJob) {
    const doc = await loadDocument(organizationId, ocrJob.documentId);
    await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.view);
    const task = await findTaskByLegacyCode(ocrJob.publicCode);
    return {
      job: publicJob({
        ...ocrJob,
        kind: "ocr",
        resultJson: ocrJob.result
          ? {
              text: ocrJob.result.text,
              language: ocrJob.result.language,
              handwritingLikely: ocrJob.result.handwritingLikely,
            }
          : null,
        explanationJson: ocrJob.result?.explanationJson ?? null,
      }),
      task: task
        ? {
            publicCode: task.publicCode,
            status: task.status,
            queueName: task.queueName,
            attemptCount: task.attemptCount,
            legacyJobPublicCode: task.legacyJobPublicCode,
            artifactPublicCode: task.artifactPublicCode,
          }
        : null,
      lineage: ocrJob.lineage
        ? { publicCode: ocrJob.lineage.publicCode, steps: ocrJob.lineage.stepsJson }
        : null,
    };
  }

  throw new AppError(404, "AI_JOB_NOT_FOUND", "AI job not found");
}

export async function reviewAiJob(
  userId: string,
  organizationId: string,
  jobId: string,
  input: { status: string; notes?: string },
) {
  assertSafeAiOperation("human_review");
  await assertOrgMember(userId, organizationId);
  if (
    !(
      [
        AiReviewStates.approved,
        AiReviewStates.rejected,
        AiReviewStates.escalated,
        AiReviewStates.pendingReview,
      ] as string[]
    ).includes(input.status)
  ) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid review status");
  }

  const aiJob = await prisma.aiJob.findFirst({
    where: { organizationId, OR: [{ publicCode: jobId }, { id: jobId }] },
  });
  if (!aiJob) throw new AppError(404, "AI_JOB_NOT_FOUND", "AI job not found");
  if (aiJob.documentId) {
    const doc = await loadDocument(organizationId, aiJob.documentId);
    await assertDocumentPermission(userId, toAccessContext(doc), DocumentPermissions.edit);
  }

  await prisma.aiJob.update({
    where: { id: aiJob.id },
    data: { reviewStatus: input.status },
  });
  const review = await prisma.aiHumanReview.create({
    data: {
      aiJobId: aiJob.id,
      reviewerId: userId,
      status: input.status,
      notes: input.notes,
      decidedAt: new Date(),
    },
  });
  await writeAiAudit({
    organizationId,
    actorUserId: userId,
    jobPublicCode: aiJob.publicCode,
    action: "ai.review",
    payload: input,
  });
  aiAnalyticsInc("reviews");

  return {
    job: { publicCode: aiJob.publicCode, reviewStatus: input.status },
    review: {
      status: review.status,
      notes: review.notes,
      decidedAt: review.decidedAt?.toISOString() ?? null,
    },
  };
}

export async function seedDefaultModels(): Promise<number> {
  const entries = [
    {
      provider: AiModelProviders.local,
      modelId: "AI-MODEL-OCR00001",
      version: "MODEL-VERSION-OCR00001",
      capability: "ocr",
      isDefault: true,
      isFallback: true,
    },
    {
      provider: AiModelProviders.openai,
      modelId: "AI-MODEL-EXTRACT1",
      version: "MODEL-VERSION-EXTRACT1",
      capability: "extract",
      isDefault: false,
      isFallback: false,
    },
    {
      provider: AiModelProviders.gemini,
      modelId: "AI-MODEL-CLASSIFY",
      version: "MODEL-VERSION-CLASSIFY",
      capability: "classify",
      isDefault: false,
      isFallback: false,
    },
    {
      provider: AiModelProviders.local,
      modelId: "AI-MODEL-EMBED001",
      version: "MODEL-VERSION-EMBED001",
      capability: "embed",
      isDefault: true,
      isFallback: true,
    },
  ];
  let count = 0;
  for (const e of entries) {
    await prisma.aiModelRegistryEntry.upsert({
      where: {
        provider_modelId_version_capability: {
          provider: e.provider,
          modelId: e.modelId,
          version: e.version,
          capability: e.capability,
        },
      },
      create: e,
      update: { active: true, isDefault: e.isDefault, isFallback: e.isFallback },
    });
    count += 1;
  }
  return count;
}
