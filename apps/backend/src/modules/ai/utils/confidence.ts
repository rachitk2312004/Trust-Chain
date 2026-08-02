export type ConfidenceBundle = {
  confidence: number;
  confidenceInterval: { low: number; high: number };
  confidenceLow: number;
  confidenceHigh: number;
  modelVersion: string;
  evaluationVersion: string;
};

export type CostBundle = {
  tokenUsage: number;
  computeUsage: number;
  storageUsage: number;
  estimatedCost: number;
};

export function buildConfidence(input?: {
  confidence?: number;
  low?: number;
  high?: number;
  modelVersion?: string;
  evaluationVersion?: string;
}): ConfidenceBundle {
  const confidence = clamp01(input?.confidence ?? 0.72);
  const low = clamp01(input?.low ?? Math.max(0, confidence - 0.12));
  const high = clamp01(input?.high ?? Math.min(1, confidence + 0.08));
  return {
    confidence,
    confidenceInterval: { low, high },
    confidenceLow: low,
    confidenceHigh: high,
    modelVersion: input?.modelVersion ?? "MODEL-VERSION-LOCAL001",
    evaluationVersion: input?.evaluationVersion ?? "eval-1.0.0",
  };
}

export function buildCost(input?: Partial<CostBundle>): CostBundle {
  return {
    tokenUsage: input?.tokenUsage ?? 0,
    computeUsage: input?.computeUsage ?? 5,
    storageUsage: input?.storageUsage ?? 0,
    estimatedCost: input?.estimatedCost ?? 0,
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
