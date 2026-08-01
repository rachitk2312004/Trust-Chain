import assert from "node:assert/strict";
import { AiIdPrefixes, AiJobStates, AiReviewStates } from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import { buildConfidence, buildCost } from "../utils/confidence.js";
import {
  assertSafeAiOperation,
  FORBIDDEN_AI_OPERATIONS,
  AI_ADVISORY_DISCLAIMER,
} from "../utils/guards.js";
import { generateAiPublicCode } from "../utils/ids.js";
import {
  cosineSimilarity,
  stubClassify,
  stubExtract,
  stubFraudSignals,
} from "../services/processor.js";

export function testAiPublicCodes(): void {
  assert.match(generateAiPublicCode("ocrJob"), new RegExp(`^${AiIdPrefixes.ocrJob}-[0-9A-F]{8}$`));
  assert.match(generateAiPublicCode("aiJob"), new RegExp(`^${AiIdPrefixes.aiJob}-[0-9A-F]{8}$`));
  assert.match(
    generateAiPublicCode("embeddingJob"),
    new RegExp(`^${AiIdPrefixes.embeddingJob}-[0-9A-F]{8}$`),
  );
  assert.match(
    generateAiPublicCode("lineage"),
    new RegExp(`^${AiIdPrefixes.lineage}-[0-9A-F]{8}$`),
  );
}

export function testConfidenceAndCost(): void {
  const c = buildConfidence({ confidence: 0.8 });
  assert.equal(c.confidence, 0.8);
  assert.ok(c.confidenceInterval.low <= c.confidence);
  assert.ok(c.confidenceInterval.high >= c.confidence);
  assert.ok(c.modelVersion);
  assert.ok(c.evaluationVersion);
  const cost = buildCost({
    tokenUsage: 10,
    computeUsage: 5,
    storageUsage: 100,
    estimatedCost: 0.01,
  });
  assert.equal(cost.tokenUsage, 10);
  assert.equal(cost.estimatedCost, 0.01);
}

export function testForbiddenOperations(): void {
  for (const op of FORBIDDEN_AI_OPERATIONS) {
    assert.throws(
      () => assertSafeAiOperation(op),
      (error) => error instanceof AppError && error.code === "AI_FORBIDDEN_OPERATION",
    );
  }
  assertSafeAiOperation("ocr");
  assertSafeAiOperation("fraud");
  assert.ok(AI_ADVISORY_DISCLAIMER.includes("advisory"));
}

export function testStubProcessors(): void {
  const entities = stubExtract("Invoice #42 dated 2026-08-01");
  assert.ok(entities.dates.includes("2026-08-01"));
  assert.ok(entities.identifiers.includes("#42"));
  const classified = stubClassify("This is an invoice for services");
  assert.equal(classified.label, "invoice");
  const fraud = stubFraudSignals("short");
  assert.ok(fraud.riskScore >= 0);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
}

export function testJobAndReviewStates(): void {
  assert.equal(AiJobStates.pending, "pending");
  assert.equal(AiJobStates.processing, "processing");
  assert.equal(AiJobStates.completed, "completed");
  assert.equal(AiJobStates.failed, "failed");
  assert.equal(AiJobStates.cancelled, "cancelled");
  assert.equal(AiReviewStates.pendingReview, "pending_review");
  assert.equal(AiReviewStates.approved, "approved");
  assert.equal(AiReviewStates.rejected, "rejected");
  assert.equal(AiReviewStates.escalated, "escalated");
}
