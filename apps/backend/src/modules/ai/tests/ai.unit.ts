import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AiIdPrefixes, AiJobStates, AiReviewStates } from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import { buildConfidence, buildCost } from "../utils/confidence.js";
import {
  assertSafeAiOperation,
  FORBIDDEN_AI_OPERATIONS,
  AI_ADVISORY_DISCLAIMER,
} from "../utils/guards.js";
import { generateAiPublicCode } from "../utils/ids.js";
import { cosineSimilarity, metaFromExecutionResult } from "../services/processor.js";
import {
  allowMemoryExecutionClient,
  allowStubAdapterFallback,
  assertAiProductionConfig,
  isAiProductionMode,
} from "../utils/aiRuntime.js";
import {
  MemoryAiExecutionClient,
  getAiExecutionClient,
  setAiExecutionClientForTests,
} from "../services/executionClient.js";

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

/** Step 6 — Express no longer ships stub OCR/extract/classify/fraud processors. */
export function testStubProcessorsRemoved(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../services/processor.ts"),
    join(here, "../services/processor.js"),
    join(here, "../../../../src/modules/ai/services/processor.ts"),
  ];
  const path = candidates.find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  });
  assert.ok(path, "processor source not found");
  const source = readFileSync(path!, "utf8");
  assert.equal(source.includes("export function stubExtract"), false);
  assert.equal(source.includes("export function stubClassify"), false);
  assert.equal(source.includes("export function stubFraudSignals"), false);
  assert.equal(source.includes("export function stubOcrText"), false);
  assert.equal(source.includes("export function stubEmbedChunks"), false);
  assert.equal(source.includes("setImmediate"), false);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  const meta = metaFromExecutionResult("ocr", {
    advisoryOnly: true,
    confidence: 0.91,
    modelVersion: "MODEL-VERSION-OCR00001",
    provider: "local",
    executionTimeMs: 12,
    lineageId: "LINEAGE-AABBCCDD",
  });
  assert.equal(meta.confidence.confidence, 0.91);
  assert.equal(meta.modelProvider, "local");
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

export function testProductionConfigValidation(): void {
  const prev = {
    NODE_ENV: process.env.NODE_ENV,
    AI_EXECUTION_MODE: process.env.AI_EXECUTION_MODE,
    AI_SERVICE_URL: process.env.AI_SERVICE_URL,
    AI_SERVICE_TOKEN: process.env.AI_SERVICE_TOKEN,
    REDIS_URL: process.env.REDIS_URL,
    AI_QUEUE_BACKEND: process.env.AI_QUEUE_BACKEND,
    AI_ALLOW_STUB_FALLBACK: process.env.AI_ALLOW_STUB_FALLBACK,
    AI_EXECUTION_ALLOW_MEMORY: process.env.AI_EXECUTION_ALLOW_MEMORY,
  };
  try {
    process.env.AI_EXECUTION_MODE = "production";
    delete process.env.AI_SERVICE_URL;
    delete process.env.AI_SERVICE_TOKEN;
    delete process.env.REDIS_URL;
    delete process.env.AI_QUEUE_BACKEND;
    assert.equal(isAiProductionMode(), true);
    assert.equal(allowMemoryExecutionClient(), false);
    assert.equal(allowStubAdapterFallback(), false);
    assert.throws(() => assertAiProductionConfig(), /AI production configuration incomplete/);

    process.env.AI_SERVICE_URL = "http://127.0.0.1:8090";
    process.env.AI_SERVICE_TOKEN = "token";
    process.env.REDIS_URL = "redis://127.0.0.1:6379";
    assertAiProductionConfig();
  } finally {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

export async function testMemoryClientForbiddenInProduction(): Promise<void> {
  const prevMode = process.env.AI_EXECUTION_MODE;
  const prevUrl = process.env.AI_SERVICE_URL;
  try {
    process.env.AI_EXECUTION_MODE = "production";
    delete process.env.AI_SERVICE_URL;
    setAiExecutionClientForTests(null);
    assert.throws(() => getAiExecutionClient(), (error: unknown) => {
      return error instanceof AppError && error.code === "AI_SERVICE_UNAVAILABLE";
    });
    const memory = new MemoryAiExecutionClient();
    await assert.rejects(
      () => memory.submit({ capability: "ocr", payload: {} }),
      (error: unknown) =>
        error instanceof AppError && error.code === "AI_MEMORY_CLIENT_FORBIDDEN",
    );
  } finally {
    if (prevMode === undefined) delete process.env.AI_EXECUTION_MODE;
    else process.env.AI_EXECUTION_MODE = prevMode;
    if (prevUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = prevUrl;
    setAiExecutionClientForTests(null);
  }
}

export async function testLineageAndValidationFields(): Promise<void> {
  const client = new MemoryAiExecutionClient();
  setAiExecutionClientForTests(client);
  const submitted = await client.submit({
    capability: "ocr",
    payload: { imageData: "ab" },
    taskId: "AI-TASK-LINEAGE1",
  });
  await client.drain(["ocr"]);
  const status = await client.status(submitted.taskId);
  assert.equal(status.status, "completed");
  const result = status.result as Record<string, unknown>;
  assert.equal(result.advisoryOnly, true);
  assert.ok(typeof result.modelId === "string");
  assert.ok(typeof result.modelVersion === "string");
  assert.ok(typeof result.executionTimeMs === "number");
  assert.ok(typeof result.lineageId === "string");
  assert.ok(typeof result.confidence === "number");
  setAiExecutionClientForTests(null);
}
