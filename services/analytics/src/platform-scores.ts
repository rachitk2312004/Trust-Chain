import { clamp01 } from "../../shared/types.js";

export type PlatformScoreInput = {
  trustSignals?: number;
  healthSignals?: number;
  riskSignals?: number;
  complianceSignals?: number;
};

export type PlatformScores = {
  trustScore: number;
  healthScore: number;
  riskScore: number;
  complianceScore: number;
};

export function computePlatformScores(input: PlatformScoreInput): PlatformScores {
  return {
    trustScore: clamp01(input.trustSignals ?? 0.5),
    healthScore: clamp01(input.healthSignals ?? 0.5),
    riskScore: clamp01(input.riskSignals ?? 0.5),
    complianceScore: clamp01(input.complianceSignals ?? 0.5),
  };
}
