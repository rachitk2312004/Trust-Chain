import { PlatformScoreDefaults } from "@trustchain/config";

export type PlatformScores = {
  trustScore: number;
  healthScore: number;
  riskScore: number;
  complianceScore: number;
};

export function computePlatformScores(input?: Partial<PlatformScores>): PlatformScores {
  return {
    trustScore: clamp01(input?.trustScore ?? PlatformScoreDefaults.trustScore),
    healthScore: clamp01(input?.healthScore ?? PlatformScoreDefaults.healthScore),
    riskScore: clamp01(input?.riskScore ?? PlatformScoreDefaults.riskScore),
    complianceScore: clamp01(input?.complianceScore ?? PlatformScoreDefaults.complianceScore),
  };
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
