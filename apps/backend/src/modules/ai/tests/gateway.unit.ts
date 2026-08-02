import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AiIdPrefixes, AiQueueNames } from "@trustchain/config";
import { capabilityForKind, mapLegacyToTask } from "../services/compatibility.js";
import {
  MemoryAiExecutionClient,
  executionMode,
  setAiExecutionClientForTests,
} from "../services/executionClient.js";
import { generateAiPublicCode } from "../utils/ids.js";
import { aiDocumentBodySchema, aiSearchBodySchema } from "../validators/schemas.js";

export function testRouteValidationSchemas(): void {
  const ok = aiDocumentBodySchema.parse({
    organizationId: "11111111-1111-1111-1111-111111111111",
    documentId: "22222222-2222-2222-2222-222222222222",
    engine: "stub",
  });
  assert.equal(ok.engine, "stub");
  assert.throws(() => aiDocumentBodySchema.parse({ documentId: "not-a-uuid" }));
  const search = aiSearchBodySchema.parse({
    query: "invoice",
    limit: 5,
  });
  assert.equal(search.query, "invoice");
}

export function testCompatibilityMapping(): void {
  assert.equal(capabilityForKind("ocr"), AiQueueNames.ocr);
  assert.equal(capabilityForKind("extract"), AiQueueNames.extraction);
  assert.equal(capabilityForKind("classify"), AiQueueNames.classification);
  assert.equal(capabilityForKind("search"), AiQueueNames.embedding);
  assert.equal(capabilityForKind("fraud"), AiQueueNames.fraud);
  const mapped = mapLegacyToTask({
    legacyJobPublicCode: "OCR-JOB-AABBCCDD",
    taskPublicCode: "AI-TASK-11223344",
    kind: "ocr",
  });
  assert.equal(mapped.queueName, "ocr");
  assert.equal(mapped.legacyJobPublicCode, "OCR-JOB-AABBCCDD");
  assert.equal(mapped.taskPublicCode, "AI-TASK-11223344");
}

export function testPhase2PublicCodePrefixes(): void {
  assert.match(generateAiPublicCode("task"), new RegExp(`^${AiIdPrefixes.task}-[0-9A-F]{8}$`));
  assert.match(
    generateAiPublicCode("classificationJob"),
    new RegExp(`^${AiIdPrefixes.classificationJob}-[0-9A-F]{8}$`),
  );
  assert.match(
    generateAiPublicCode("artifact"),
    new RegExp(`^${AiIdPrefixes.artifact}-[0-9A-F]{8}$`),
  );
  assert.match(generateAiPublicCode("model"), new RegExp(`^${AiIdPrefixes.model}-[0-9A-F]{8}$`));
  assert.match(
    generateAiPublicCode("modelVersion"),
    new RegExp(`^${AiIdPrefixes.modelVersion}-[0-9A-F]{8}$`),
  );
}

export async function testMemoryExecutionClientQueueSubmit(): Promise<void> {
  const client = new MemoryAiExecutionClient();
  setAiExecutionClientForTests(client);
  const submitted = await client.submit({
    capability: "ocr",
    payload: { imageData: "ab" },
    legacyJobPublicCode: "OCR-JOB-TEST0001",
    taskId: "AI-TASK-TEST0001",
  });
  assert.equal(submitted.status, "pending");
  assert.equal(submitted.taskId, "AI-TASK-TEST0001");
  const drained = await client.drain(["ocr"]);
  assert.ok(drained.processed >= 1);
  const status = await client.status("AI-TASK-TEST0001");
  assert.equal(status.status, "completed");
  assert.equal(executionMode(), process.env.AI_SERVICE_URL?.trim() ? "gateway" : "memory");
  setAiExecutionClientForTests(null);
}

export async function testHealthAndModelsViaMemoryClient(): Promise<void> {
  const client = new MemoryAiExecutionClient();
  setAiExecutionClientForTests(client);
  const health = await client.health();
  assert.equal(health.status, "ok");
  assert.ok(health.queues);
  const models = await client.models();
  assert.ok(models.models.length >= 1);
  assert.ok(models.models[0]!.modelId.startsWith("AI-MODEL-"));
  assert.ok(models.models[0]!.modelVersion.startsWith("MODEL-VERSION-"));
  setAiExecutionClientForTests(null);
}

export function testGatewayDoesNotImportWorkers(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, "../services/executionClient.ts"),
    join(here, "../services/executionClient.js"),
    join(here, "../../../../src/modules/ai/services/executionClient.ts"),
  ];
  const path = candidates.find((p) => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  });
  assert.ok(path, "executionClient source not found");
  const source = readFileSync(path!, "utf8");
  assert.equal(/import\s+.*workers/.test(source), false);
  assert.equal(source.includes("ocr.engine"), false);
  assert.equal(source.includes("/internal/execution/"), true);
}