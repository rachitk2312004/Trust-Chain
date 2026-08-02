/**
 * Phase 2 Step 7 — Express AI gateway hardening tests.
 * No DB required: route wiring, compatibility, security, client failures, load.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AiIdPrefixes } from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import { capabilityForKind, mapLegacyToTask } from "../services/compatibility.js";
import {
  MemoryAiExecutionClient,
  HttpAiExecutionClient,
  setAiExecutionClientForTests,
} from "../services/executionClient.js";
import { assertSafeAiOperation, FORBIDDEN_AI_OPERATIONS, AI_ADVISORY_DISCLAIMER } from "../utils/guards.js";
import { generateAiPublicCode } from "../utils/ids.js";
import {
  assertAiProductionConfig,
  isAiProductionMode,
  allowStubAdapterFallback,
} from "../utils/aiRuntime.js";

function aiModuleRoot(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, ".."), join(here, "../../../../src/modules/ai")];
  for (const c of candidates) {
    try {
      if (statSync(join(c, "routes")).isDirectory()) return c;
    } catch {
      /* continue */
    }
  }
  return join(here, "..");
}

function collectTsSources(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) collectTsSources(full, acc);
    else if (name.endsWith(".ts") || name.endsWith(".js")) acc.push(full);
  }
  return acc;
}

function readAiSource(relativePath: string): string {
  const root = aiModuleRoot();
  const base = relativePath.replace(/\.tsx?$/, "");
  const candidates = [
    join(root, `${base}.ts`),
    join(root, `${base}.js`),
    join(root, "../../../../src/modules/ai", `${base}.ts`),
  ];
  for (const path of candidates) {
    try {
      return readFileSync(path, "utf8");
    } catch {
      /* continue */
    }
  }
  throw new Error(`AI source not found: ${relativePath}`);
}

/** Maps Express public routes ↔ execution capabilities (integration contract check). */
export function testExpressRouteSurfaceWiring(): void {
  const router = readAiSource("routes/ai.router");
  for (const route of [
    'post("/ocr"',
    'post("/classify"',
    'post("/extract"',
    'post("/search"',
    'post("/fraud"',
    'get("/jobs/:jobId"',
    'get("/models"',
    'get("/health"',
  ]) {
    assert.ok(router.includes(route), `missing route fragment ${route}`);
  }
  assert.ok(router.includes("requireAuth"));
}

export function testCompatibilityIdPrefixesRemainValid(): void {
  assert.match(generateAiPublicCode("ocrJob"), new RegExp(`^${AiIdPrefixes.ocrJob}-[0-9A-F]{8}$`));
  assert.match(generateAiPublicCode("aiJob"), new RegExp(`^${AiIdPrefixes.aiJob}-[0-9A-F]{8}$`));
  assert.match(
    generateAiPublicCode("embeddingJob"),
    new RegExp(`^${AiIdPrefixes.embeddingJob}-[0-9A-F]{8}$`),
  );
  assert.match(
    generateAiPublicCode("classificationJob"),
    new RegExp(`^${AiIdPrefixes.classificationJob}-[0-9A-F]{8}$`),
  );
  assert.match(generateAiPublicCode("lineage"), new RegExp(`^${AiIdPrefixes.lineage}-[0-9A-F]{8}$`));

  const kinds = ["ocr", "extract", "classify", "search", "fraud", "embed"] as const;
  for (const kind of kinds) {
    const mapped = mapLegacyToTask({
      legacyJobPublicCode: `AI-JOB-COMPAT01`,
      taskPublicCode: `AI-TASK-COMPAT01`,
      kind,
    });
    assert.equal(mapped.queueName, capabilityForKind(kind));
    assert.ok(mapped.queueName.length > 0);
  }
}

export function testSecurityRbacAndForbiddenOps(): void {
  for (const op of FORBIDDEN_AI_OPERATIONS) {
    assert.throws(
      () => assertSafeAiOperation(op),
      (e) => e instanceof AppError && e.code === "AI_FORBIDDEN_OPERATION",
    );
  }
  assertSafeAiOperation("ocr");
  assert.ok(AI_ADVISORY_DISCLAIMER.toLowerCase().includes("advisory"));
}

export function testAiModuleForbidsBlockchainVerificationImports(): void {
  const root = aiModuleRoot();
  const files = collectTsSources(root).filter(
    (file) => !file.includes(`${join("tests")}`) && !file.includes("/tests/"),
  );
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    assert.equal(/from\s+["'][^"']*blockchain[^"']*["']/.test(source), false, file);
    assert.equal(/from\s+["'][^"']*\/verification\//.test(source), false, file);
    assert.equal(source.includes("setImmediate("), false, file);
  }
}

export async function testExecutionClientNetworkFailure(): Promise<void> {
  const prevUrl = process.env.AI_SERVICE_URL;
  const prevFetch = globalThis.fetch;
  try {
    process.env.AI_SERVICE_URL = "http://127.0.0.1:59999";
    setAiExecutionClientForTests(null);
    globalThis.fetch = (async () => {
      throw new Error("network failure");
    }) as typeof fetch;
    const client = new HttpAiExecutionClient();
    await assert.rejects(() => client.health(), (error: unknown) => {
      return error instanceof Error;
    });
  } finally {
    globalThis.fetch = prevFetch;
    if (prevUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = prevUrl;
    setAiExecutionClientForTests(null);
  }
}

export async function testExecutionClientHttpErrorStatus(): Promise<void> {
  const prevUrl = process.env.AI_SERVICE_URL;
  const prevFetch = globalThis.fetch;
  try {
    process.env.AI_SERVICE_URL = "http://ai.test";
    globalThis.fetch = (async () =>
      new Response("gateway timeout", { status: 504 })) as typeof fetch;
    const client = new HttpAiExecutionClient();
    await assert.rejects(
      () => client.submit({ capability: "ocr", payload: {} }),
      (error: unknown) => error instanceof AppError && error.code === "AI_EXECUTION_ERROR",
    );
  } finally {
    globalThis.fetch = prevFetch;
    if (prevUrl === undefined) delete process.env.AI_SERVICE_URL;
    else process.env.AI_SERVICE_URL = prevUrl;
  }
}

export async function testGatewayHealthModelsViaMemory(): Promise<void> {
  const { getAiGatewayHealth, listAiModels } = await import("../services/gatewayHealth.js");
  const client = new MemoryAiExecutionClient();
  setAiExecutionClientForTests(client);
  const health = await getAiGatewayHealth();
  assert.equal(health.advisoryOnly, true);
  assert.ok(health.disclaimer.includes("advisory"));
  const models = await listAiModels();
  assert.equal(models.advisoryOnly, true);
  assert.ok(models.models.length >= 1);
  setAiExecutionClientForTests(null);
}

export async function testMemoryPipelineLoad(): Promise<void> {
  const client = new MemoryAiExecutionClient();
  setAiExecutionClientForTests(client);
  const n = 50;
  const started = Date.now();
  for (let i = 0; i < n; i += 1) {
    await client.submit({
      capability: i % 2 === 0 ? "ocr" : "fraud",
      payload: { text: `load-${i}` },
      taskId: `AI-TASK-LOAD${String(i).padStart(4, "0")}`,
    });
  }
  const drained = await client.drain(["ocr", "fraud"]);
  const elapsedMs = Date.now() - started;
  assert.ok(drained.processed >= n);
  assert.ok(elapsedMs < 5000);
  const sample = await client.status("AI-TASK-LOAD0000");
  assert.equal(sample.status, "completed");
  const result = sample.result as Record<string, unknown>;
  assert.equal(result.advisoryOnly, true);
  assert.ok(typeof result.lineageId === "string");
  setAiExecutionClientForTests(null);
}

export function testProductionConfigHardening(): void {
  const prev = { ...process.env };
  try {
    process.env.AI_EXECUTION_MODE = "production";
    delete process.env.AI_SERVICE_URL;
    delete process.env.AI_SERVICE_TOKEN;
    delete process.env.REDIS_URL;
    delete process.env.AI_QUEUE_BACKEND;
    assert.equal(isAiProductionMode(), true);
    assert.equal(allowStubAdapterFallback(), false);
    assert.throws(() => assertAiProductionConfig(), /AI production configuration incomplete/);
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in prev)) delete process.env[key];
    }
    Object.assign(process.env, prev);
  }
}

export function testDeadCodeAuditMarkersAbsentFromGateway(): void {
  const processor = readAiSource("services/processor");
  assert.equal(processor.includes("RedisStub"), false);
  assert.equal(processor.includes("InProcessExecutor"), false);
  assert.equal(/export function stub(Extract|Classify|Ocr|Fraud|Embed)/.test(processor), false);
}
