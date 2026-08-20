import { AppError } from "../../lib/errors.js";
import { GovernanceDefaults } from "@trustchain/config";

export type RiskScoreInput = {
  likelihood: number;
  impact: number;
};

export type ResidualRiskInput = RiskScoreInput & {
  residualLikelihood?: number;
  residualImpact?: number;
  /** 0..1 mitigation effectiveness; reduces residual when residual dims omitted. */
  mitigationEffectiveness?: number;
};

/** Inherent risk score = likelihood × impact (1..25). */
export function calculateInherentRiskScore(input: RiskScoreInput): number {
  assertRiskDimension(input.likelihood, "likelihood");
  assertRiskDimension(input.impact, "impact");
  return input.likelihood * input.impact;
}

export function calculateResidualRiskScore(input: ResidualRiskInput): {
  inherentScore: number;
  residualLikelihood: number;
  residualImpact: number;
  residualScore: number;
  band: "low" | "medium" | "high" | "critical";
} {
  const inherentScore = calculateInherentRiskScore(input);
  let residualLikelihood = input.residualLikelihood ?? input.likelihood;
  let residualImpact = input.residualImpact ?? input.impact;

  if (input.residualLikelihood == null && input.residualImpact == null) {
    const effectiveness = Math.min(1, Math.max(0, input.mitigationEffectiveness ?? 0));
    const factor = 1 - effectiveness;
    residualLikelihood = Math.max(
      GovernanceDefaults.minLikelihood,
      Math.round(input.likelihood * factor),
    );
    residualImpact = Math.max(
      GovernanceDefaults.minImpact,
      Math.round(input.impact * factor),
    );
  }

  assertRiskDimension(residualLikelihood, "residualLikelihood");
  assertRiskDimension(residualImpact, "residualImpact");
  const residualScore = residualLikelihood * residualImpact;

  return {
    inherentScore,
    residualLikelihood,
    residualImpact,
    residualScore,
    band: riskBand(residualScore),
  };
}

export function riskBand(score: number): "low" | "medium" | "high" | "critical" {
  if (score <= 4) return "low";
  if (score <= 9) return "medium";
  if (score <= 16) return "high";
  return "critical";
}

export function validateOwnership(input: {
  ownerUserId: string | null | undefined;
  allowedOwnerIds: Set<string>;
}): { valid: boolean; reason?: string } {
  if (!input.ownerUserId) return { valid: true };
  if (!input.allowedOwnerIds.has(input.ownerUserId)) {
    return { valid: false, reason: "owner_not_org_member" };
  }
  return { valid: true };
}

export function assertOwnershipValid(check: { valid: boolean; reason?: string }): void {
  if (!check.valid) {
    throw new AppError(
      400,
      "OWNERSHIP_INVALID",
      check.reason === "owner_not_org_member"
        ? "Owner must be an organization member"
        : "Invalid ownership",
    );
  }
}

export function aggregateRiskPortfolio(
  risks: Array<{ residualScore: number; status: string }>,
): {
  openCount: number;
  averageResidual: number;
  maxResidual: number;
  criticalCount: number;
  portfolioScore: number;
} {
  const open = risks.filter((r) => r.status !== "closed" && r.status !== "accepted");
  const scores = open.map((r) => r.residualScore);
  const averageResidual =
    scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
  const maxResidual = scores.length === 0 ? 0 : Math.max(...scores);
  const criticalCount = open.filter((r) => riskBand(r.residualScore) === "critical").length;
  // Normalize portfolio health 0..1 (lower residual = higher score)
  const portfolioScore = Number((1 - Math.min(1, averageResidual / 25)).toFixed(3));
  return {
    openCount: open.length,
    averageResidual: Number(averageResidual.toFixed(2)),
    maxResidual,
    criticalCount,
    portfolioScore,
  };
}

function assertRiskDimension(value: number, name: string): void {
  if (
    !Number.isInteger(value) ||
    value < GovernanceDefaults.minLikelihood ||
    value > GovernanceDefaults.maxLikelihood
  ) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      `${name} must be an integer between ${GovernanceDefaults.minLikelihood} and ${GovernanceDefaults.maxLikelihood}`,
    );
  }
}
