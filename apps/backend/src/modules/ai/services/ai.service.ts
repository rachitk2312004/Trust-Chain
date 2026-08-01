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
import {
  advisoryResultMeta,
  cosineSimilarity,
  stubClassify,
  stubEmbedChunks,
  stubExtract,
  stubFraudSignals,
  stubOcrText,
} from "./processor.js";
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

function schedule(fn: () => Promise<void>): void {
  setImmediate(() => {
    void fn().catch(() => {
      /* job row captures failure */
    });
  });
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
      : OcrEngines.stub;

  const ocrJob = await prisma.ocrJob.create({
    data: {
      publicCode: generateAiPublicCode("ocrJob"),
      organizationId,
      documentId: doc.id,
      documentVersionId: input.documentVersionId ?? doc.currentVersionId ?? undefined,
      aiJobId: parent.id,
      lineageId: lineage.id,
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

  schedule(() => completeOcrJob(ocrJob.id, parent.id, lineage.id, doc.id));

  return {
    job: publicJob({ ...parent, kind: "ocr" }),
    ocrJob: { publicCode: ocrJob.publicCode, status: ocrJob.status, engine: ocrJob.engine },
    lineage: { publicCode: lineage.publicCode },
  };
}

async function completeOcrJob(
  ocrJobId: string,
  aiJobId: string,
  lineageId: string,
  documentId: string,
): Promise<void> {
  await prisma.ocrJob.update({
    where: { id: ocrJobId },
    data: { status: AiJobStates.processing },
  });
  await prisma.aiJob.update({
    where: { id: aiJobId },
    data: { status: AiJobStates.processing },
  });

  try {
    const ocr = stubOcrText(documentId);
    const meta = advisoryResultMeta("ocr");
    await prisma.ocrResult.create({
      data: {
        ocrJobId,
        text: ocr.text,
        language: ocr.language,
        handwritingLikely: ocr.handwritingLikely,
        layoutJson: ocr.layoutJson,
        confidence: meta.confidence.confidence,
        confidenceLow: meta.confidence.confidenceLow,
        confidenceHigh: meta.confidence.confidenceHigh,
        modelVersion: meta.confidence.modelVersion,
        evaluationVersion: meta.confidence.evaluationVersion,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await prisma.ocrJob.update({
      where: { id: ocrJobId },
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
      where: { id: aiJobId },
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
          text: ocr.text,
          language: ocr.language,
          handwritingLikely: ocr.handwritingLikely,
        },
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await appendLineageStep(lineageId, "ocr_result", ocrJobId);
    aiAnalyticsInc("jobsCompleted");
    aiAnalyticsInc("tokenUsage", meta.cost.tokenUsage);
    aiAnalyticsInc("estimatedCostUsd", meta.cost.estimatedCost);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ocr_failed";
    await prisma.ocrJob.update({
      where: { id: ocrJobId },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    await prisma.aiJob.update({
      where: { id: aiJobId },
      data: { status: AiJobStates.failed, error: message, completedAt: new Date() },
    });
    aiAnalyticsInc("jobsFailed");
  }
}

async function latestOcrText(organizationId: string, documentId: string): Promise<string> {
  const job = await prisma.ocrJob.findFirst({
    where: { organizationId, documentId, status: AiJobStates.completed },
    orderBy: { completedAt: "desc" },
    include: { result: true },
  });
  if (job?.result?.text) return job.result.text;
  return stubOcrText(documentId).text;
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

  schedule(async () => {
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: { status: AiJobStates.processing },
    });
    const text = await latestOcrText(organizationId, doc.id);
    const entities = stubExtract(text);
    const meta = advisoryResultMeta("extract");
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
        resultJson: entities as Prisma.InputJsonValue,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await appendLineageStep(lineage.id, "extraction_result", parent.publicCode);
    aiAnalyticsInc("jobsCompleted");
  });

  return {
    job: publicJob({ ...parent, kind: "extract" }),
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
      publicCode: generateAiPublicCode("aiJob"),
      organizationId,
      documentId: doc.id,
      lineageId: lineage.id,
      status: AiJobStates.pending,
      reviewStatus: AiReviewStates.pendingReview,
      modelProvider: AiModelProviders.stub,
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

  schedule(async () => {
    await prisma.classificationJob.update({
      where: { id: classifyJob.id },
      data: { status: AiJobStates.processing },
    });
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: { status: AiJobStates.processing },
    });
    const text = await latestOcrText(organizationId, doc.id);
    const classified = stubClassify(text);
    const meta = advisoryResultMeta("classify");
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
        resultJson: classified as Prisma.InputJsonValue,
        explanationJson: meta.explanation as Prisma.InputJsonValue,
      },
    });
    await appendLineageStep(lineage.id, "classification_result", classifyJob.publicCode);
    aiAnalyticsInc("jobsCompleted");
  });

  return {
    job: publicJob({ ...parent, kind: "classify" }),
    classificationJob: { publicCode: classifyJob.publicCode, status: classifyJob.status },
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
    const chunks = stubEmbedChunks(text);
    const embedJob = await prisma.embeddingJob.create({
      data: {
        publicCode: generateAiPublicCode("embeddingJob"),
        organizationId,
        documentId: doc.id,
        lineageId: lineage.id,
        status: AiJobStates.completed,
        reviewStatus: AiReviewStates.pendingReview,
        modelProvider: AiModelProviders.stub,
        modelVersion: "stub-embed-1.0.0",
        evaluationVersion: "eval-1.0.0",
        confidence: 0.8,
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
        modelVersion: "stub-embed-1.0.0",
      })),
    });
    await appendLineageStep(lineage.id, "embedding_result", embedJob.publicCode);
  }

  const queryVec = stubEmbedChunks(input.query)[0]!.embedding;
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

  const meta = advisoryResultMeta("search");
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
      modelProvider: AiModelProviders.stub,
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

  schedule(async () => {
    await prisma.fraudAnalysisJob.update({
      where: { id: fraudJob.id },
      data: { status: AiJobStates.processing },
    });
    await prisma.aiJob.update({
      where: { id: parent.id },
      data: { status: AiJobStates.processing },
    });
    const text = await latestOcrText(organizationId, doc.id);
    const fraud = stubFraudSignals(text);
    const meta = advisoryResultMeta("fraud");
    const result = {
      ...fraud,
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
  });

  return {
    job: publicJob({ ...parent, kind: "fraud" }),
    fraudJob: {
      publicCode: fraudJob.publicCode,
      status: fraudJob.status,
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
    return {
      job: publicJob({ ...aiJob, kind: aiJob.kind }),
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
      provider: AiModelProviders.stub,
      modelId: "stub-ocr",
      version: "1.0.0",
      capability: "ocr",
      isDefault: true,
      isFallback: true,
    },
    {
      provider: AiModelProviders.openai,
      modelId: "gpt-4o-mini",
      version: "2024-07",
      capability: "extract",
      isDefault: false,
      isFallback: false,
    },
    {
      provider: AiModelProviders.gemini,
      modelId: "gemini-1.5-flash",
      version: "1",
      capability: "classify",
      isDefault: false,
      isFallback: false,
    },
    {
      provider: AiModelProviders.local,
      modelId: "local-embed",
      version: "1.0.0",
      capability: "embed",
      isDefault: false,
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
