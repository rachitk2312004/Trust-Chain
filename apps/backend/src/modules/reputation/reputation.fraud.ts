import {
  ReputationAlertSeverities,
  ReputationDefaults,
  ReputationProfileStatuses,
} from "@trustchain/config";

export type FraudSignals = {
  /** Rapid score swings */
  scoreVelocity?: number;
  /** Duplicate / shared identifier collisions */
  identityCollisions?: number;
  /** Failed verification burst */
  failedVerificationBurst?: number;
  /** Unusual install / linking rate */
  burstActivity?: number;
  /** Known-bad indicator 0..1 */
  denylistHit?: number;
};

export type AnomalyResult = {
  anomalous: boolean;
  zScore: number;
  mean: number;
  stdDev: number;
  latest: number;
};

export function detectAnomaly(input: {
  historyScores: number[];
  latestScore: number;
  threshold?: number;
}): AnomalyResult {
  const threshold = input.threshold ?? ReputationDefaults.anomalyZThreshold;
  if (input.historyScores.length < 3) {
    return {
      anomalous: false,
      zScore: 0,
      mean: input.latestScore,
      stdDev: 0,
      latest: input.latestScore,
    };
  }
  const mean =
    input.historyScores.reduce((a, b) => a + b, 0) / input.historyScores.length;
  const variance =
    input.historyScores.reduce((s, v) => s + (v - mean) ** 2, 0) /
    input.historyScores.length;
  const stdDev = Math.sqrt(variance);
  const zScore = stdDev === 0 ? 0 : (input.latestScore - mean) / stdDev;
  return {
    anomalous: Math.abs(zScore) >= threshold,
    zScore: Number(zScore.toFixed(3)),
    mean: Number(mean.toFixed(3)),
    stdDev: Number(stdDev.toFixed(3)),
    latest: input.latestScore,
  };
}

export function calculateFraudScore(signals: FraudSignals): number {
  const velocity = Math.min(1, Math.max(0, signals.scoreVelocity ?? 0));
  const collisions = Math.min(1, Math.max(0, (signals.identityCollisions ?? 0) / 5));
  const failedBurst = Math.min(1, Math.max(0, signals.failedVerificationBurst ?? 0));
  const burst = Math.min(1, Math.max(0, signals.burstActivity ?? 0));
  const denylist = Math.min(1, Math.max(0, signals.denylistHit ?? 0));

  const score = Number(
    (
      velocity * 0.25 +
      collisions * 0.2 +
      failedBurst * 0.2 +
      burst * 0.15 +
      denylist * 0.2
    ).toFixed(3),
  );
  return Math.min(1, Math.max(0, score));
}

export type FraudAssessment = {
  fraudScore: number;
  flagged: boolean;
  severity: string | null;
  reasons: string[];
  suggestedStatus: string;
  anomaly: AnomalyResult | null;
};

export function assessFraud(input: {
  fraudSignals: FraudSignals;
  historyScores?: number[];
  latestOverallScore?: number;
}): FraudAssessment {
  const fraudScore = calculateFraudScore(input.fraudSignals);
  const reasons: string[] = [];

  if ((input.fraudSignals.scoreVelocity ?? 0) >= 0.6) reasons.push("high_score_velocity");
  if ((input.fraudSignals.identityCollisions ?? 0) >= 2) reasons.push("identity_collisions");
  if ((input.fraudSignals.failedVerificationBurst ?? 0) >= 0.5)
    reasons.push("failed_verification_burst");
  if ((input.fraudSignals.burstActivity ?? 0) >= 0.7) reasons.push("burst_activity");
  if ((input.fraudSignals.denylistHit ?? 0) >= 0.5) reasons.push("denylist_hit");

  let anomaly: AnomalyResult | null = null;
  if (input.historyScores && input.latestOverallScore != null) {
    anomaly = detectAnomaly({
      historyScores: input.historyScores,
      latestScore: input.latestOverallScore,
    });
    if (anomaly.anomalous) reasons.push("score_anomaly");
  }

  const flagged =
    fraudScore >= ReputationDefaults.fraudFlagThreshold || Boolean(anomaly?.anomalous);

  let severity: string | null = null;
  if (fraudScore >= 0.85 || (input.fraudSignals.denylistHit ?? 0) >= 0.8) {
    severity = ReputationAlertSeverities.critical;
  } else if (fraudScore >= ReputationDefaults.fraudFlagThreshold) {
    severity = ReputationAlertSeverities.high;
  } else if (anomaly?.anomalous) {
    severity = ReputationAlertSeverities.medium;
  } else if (fraudScore >= 0.35) {
    severity = ReputationAlertSeverities.low;
  }

  const suggestedStatus = flagged
    ? fraudScore >= 0.85
      ? ReputationProfileStatuses.suspended
      : ReputationProfileStatuses.flagged
    : fraudScore >= 0.35
      ? ReputationProfileStatuses.watched
      : ReputationProfileStatuses.active;

  return {
    fraudScore,
    flagged,
    severity,
    reasons,
    suggestedStatus,
    anomaly,
  };
}

export function buildAlertTitle(reasons: string[]): string {
  if (reasons.includes("denylist_hit")) return "Denylist match detected";
  if (reasons.includes("score_anomaly")) return "Reputation score anomaly";
  if (reasons.includes("identity_collisions")) return "Identity collision risk";
  if (reasons.includes("high_score_velocity")) return "Rapid reputation swing";
  return "Fraud risk elevated";
}
