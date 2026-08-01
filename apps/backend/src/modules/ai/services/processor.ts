import { createHash } from "node:crypto";
import { AiEmbeddingDefaults, AiModelProviders } from "@trustchain/config";
import { buildConfidence, buildCost } from "../utils/confidence.js";
import { buildExplanation } from "./explainability.js";

export function stubOcrText(documentId: string): {
  text: string;
  language: string;
  handwritingLikely: boolean;
  layoutJson: { pages: number; blocks: number };
} {
  return {
    text: `TrustChain stub OCR for document ${documentId}. Invoice #1001 dated 2026-01-15.`,
    language: "en",
    handwritingLikely: false,
    layoutJson: { pages: 1, blocks: 3 },
  };
}

export function stubExtract(text: string): {
  names: string[];
  addresses: string[];
  dates: string[];
  identifiers: string[];
  organizations: string[];
  signatures: Array<{ present: boolean; region: null }>;
} {
  const dates = text.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const ids = text.match(/#\d+/g) ?? [];
  return {
    names: [],
    addresses: [],
    dates,
    identifiers: ids,
    organizations: ["TrustChain"],
    signatures: [{ present: false, region: null }],
  };
}

export function stubClassify(text: string): { label: string; scoresJson: Record<string, number> } {
  const lower = text.toLowerCase();
  const labels = [
    "invoice",
    "contract",
    "certificate",
    "transcript",
    "passport",
    "license",
    "other",
  ];
  const scores: Record<string, number> = Object.fromEntries(labels.map((l) => [l, 0.05]));
  let label = "other";
  if (lower.includes("invoice")) label = "invoice";
  else if (lower.includes("contract")) label = "contract";
  else if (lower.includes("certificate")) label = "certificate";
  else if (lower.includes("transcript")) label = "transcript";
  else if (lower.includes("passport")) label = "passport";
  else if (lower.includes("license")) label = "license";
  scores[label] = 0.78;
  return { label, scoresJson: scores };
}

export function stubEmbedChunks(
  text: string,
): Array<{ chunkIndex: number; chunkText: string; embedding: number[] }> {
  const size = AiEmbeddingDefaults.chunkSize;
  const chunks: Array<{ chunkIndex: number; chunkText: string; embedding: number[] }> = [];
  for (let i = 0, idx = 0; i < text.length; i += size, idx += 1) {
    const chunkText = text.slice(i, i + size);
    chunks.push({ chunkIndex: idx, chunkText, embedding: deterministicEmbedding(chunkText) });
  }
  if (chunks.length === 0) {
    chunks.push({ chunkIndex: 0, chunkText: text || " ", embedding: deterministicEmbedding(" ") });
  }
  return chunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export function stubFraudSignals(text: string): {
  riskScore: number;
  signalsJson: Array<{ code: string; severity: string; message: string }>;
} {
  const signals: Array<{ code: string; severity: string; message: string }> = [];
  if (text.length < 20) {
    signals.push({
      code: "thin_content",
      severity: "low",
      message: "Extracted text is unusually short",
    });
  }
  if (/copy|duplicate|sample/i.test(text)) {
    signals.push({
      code: "duplicate_language",
      severity: "medium",
      message: "Text contains duplication-like language",
    });
  }
  const riskScore = Math.min(1, signals.length * 0.25);
  return { riskScore, signalsJson: signals };
}

export function advisoryResultMeta(kind: string) {
  const confidence = buildConfidence({
    confidence: 0.74,
    modelVersion: `${AiModelProviders.stub}-1.0.0`,
    evaluationVersion: "eval-1.0.0",
  });
  const cost = buildCost({
    tokenUsage: 32,
    computeUsage: 12,
    storageUsage: 256,
    estimatedCost: 0.0001,
  });
  const explanation = buildExplanation({ kind });
  return { confidence, cost, explanation, modelProvider: AiModelProviders.stub };
}

function deterministicEmbedding(text: string): number[] {
  const dims = AiEmbeddingDefaults.dimensions;
  const hash = createHash("sha256").update(text).digest();
  const out = new Array<number>(dims);
  for (let i = 0; i < dims; i += 1) {
    out[i] = ((hash[i % hash.length]! / 255) * 2 - 1) * (1 / Math.sqrt(dims));
  }
  return out;
}
