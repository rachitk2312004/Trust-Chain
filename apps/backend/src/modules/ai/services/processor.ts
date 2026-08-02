/**
 * Result shaping helpers for gateway execution outcomes.
 * No stub model execution — Wave 9 dual-stack removed in Phase 2 Step 6.
 */
import { AiModelProviders } from "@trustchain/config";
import { buildConfidence, buildCost } from "../utils/confidence.js";
import { buildExplanation } from "./explainability.js";

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

export function metaFromExecutionResult(
  kind: string,
  result: Record<string, unknown> | null | undefined,
) {
  const confidenceValue =
    typeof result?.confidence === "number" ? result.confidence : 0.7;
  const modelVersion =
    typeof result?.modelVersion === "string"
      ? result.modelVersion
      : typeof result?.model_version === "string"
        ? result.model_version
        : "unknown";
  const evaluationVersion =
    typeof result?.evaluationVersion === "string"
      ? result.evaluationVersion
      : "eval-1.0.0";
  const confidence = buildConfidence({
    confidence: confidenceValue,
    modelVersion,
    evaluationVersion,
  });
  const cost = buildCost({
    tokenUsage: typeof result?.tokenUsage === "number" ? result.tokenUsage : 0,
    computeUsage:
      typeof result?.executionTimeMs === "number"
        ? Math.round(result.executionTimeMs)
        : typeof result?.computeUsage === "number"
          ? result.computeUsage
          : 0,
    storageUsage: typeof result?.storageUsage === "number" ? result.storageUsage : 0,
    estimatedCost: typeof result?.estimatedCost === "number" ? result.estimatedCost : 0,
  });
  const explanation = buildExplanation({
    kind,
    evidence: Array.isArray(result?.evidence) ? (result.evidence as string[]) : undefined,
    attribution: Array.isArray(result?.attribution)
      ? (result.attribution as string[])
      : undefined,
    reasoning: Array.isArray(result?.reasoning) ? (result.reasoning as string[]) : undefined,
    summary: typeof result?.summary === "string" ? result.summary : undefined,
  });
  const modelProvider =
    typeof result?.provider === "string"
      ? result.provider
      : typeof result?.modelProvider === "string"
        ? result.modelProvider
        : AiModelProviders.local;
  return { confidence, cost, explanation, modelProvider };
}

/** @deprecated Use metaFromExecutionResult — retained name for call-site migrations. */
export function advisoryResultMeta(
  kind: string,
  result?: Record<string, unknown> | null,
) {
  return metaFromExecutionResult(kind, result);
}
