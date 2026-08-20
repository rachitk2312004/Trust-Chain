import { ReputationDefaults, ReputationSubjectTypes } from "@trustchain/config";

export type ReputationSignals = {
  /** 0..1 verified / healthy ratio */
  verificationRate?: number;
  /** Successful contributions / activity volume normalized 0..1 */
  activityVolume?: number;
  /** Peer / review rating 0..1 */
  peerRating?: number;
  /** Longevity / age factor 0..1 */
  longevity?: number;
  /** Incident / failure rate 0..1 (higher = worse) */
  incidentRate?: number;
  /** Manual trust boost/penalty -1..1 */
  manualAdjustment?: number;
};

export type ScoreBreakdown = {
  trustScore: number;
  contributionScore: number;
  fraudScore: number;
  overallScore: number;
  factors: Record<string, number>;
};

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Domain-specific default weights. */
export function domainWeights(subjectType: string): {
  trust: number;
  contribution: number;
  fraudPenalty: number;
} {
  switch (subjectType) {
    case ReputationSubjectTypes.organization:
      return { trust: 0.45, contribution: 0.35, fraudPenalty: 0.4 };
    case ReputationSubjectTypes.user:
      return { trust: 0.4, contribution: 0.4, fraudPenalty: 0.45 };
    case ReputationSubjectTypes.certificate:
      return { trust: 0.55, contribution: 0.2, fraudPenalty: 0.5 };
    case ReputationSubjectTypes.signature:
      return { trust: 0.5, contribution: 0.25, fraudPenalty: 0.5 };
    case ReputationSubjectTypes.wallet:
      return { trust: 0.5, contribution: 0.2, fraudPenalty: 0.55 };
    case ReputationSubjectTypes.connector:
      return { trust: 0.35, contribution: 0.45, fraudPenalty: 0.35 };
    default:
      return { trust: 0.4, contribution: 0.35, fraudPenalty: 0.4 };
  }
}

export function calculateTrustScore(signals: ReputationSignals): number {
  const verification = clamp01(signals.verificationRate ?? ReputationDefaults.baselineTrust);
  const peer = clamp01(signals.peerRating ?? ReputationDefaults.baselineTrust);
  const longevity = clamp01(signals.longevity ?? 0.4);
  const incidents = clamp01(signals.incidentRate ?? 0);
  const manual = Math.min(1, Math.max(-1, signals.manualAdjustment ?? 0));

  const raw =
    verification * 0.35 +
    peer * 0.3 +
    longevity * 0.2 +
    (1 - incidents) * 0.15 +
    manual * 0.1;

  return Number(clamp01(raw).toFixed(3));
}

export function calculateContributionScore(signals: ReputationSignals): number {
  const activity = clamp01(signals.activityVolume ?? 0);
  const peer = clamp01(signals.peerRating ?? 0);
  const longevity = clamp01(signals.longevity ?? 0);
  return Number((activity * 0.55 + peer * 0.25 + longevity * 0.2).toFixed(3));
}

export function calculateOverallScore(input: {
  subjectType: string;
  trustScore: number;
  contributionScore: number;
  fraudScore: number;
}): number {
  const w = domainWeights(input.subjectType);
  const raw =
    input.trustScore * w.trust +
    input.contributionScore * w.contribution -
    input.fraudScore * w.fraudPenalty;
  return Number(clamp01(raw).toFixed(3));
}

export function scoreReputation(input: {
  subjectType: string;
  signals: ReputationSignals;
  fraudScore?: number;
}): ScoreBreakdown {
  const trustScore = calculateTrustScore(input.signals);
  const contributionScore = calculateContributionScore(input.signals);
  const fraudScore = clamp01(input.fraudScore ?? 0);
  const overallScore = calculateOverallScore({
    subjectType: input.subjectType,
    trustScore,
    contributionScore,
    fraudScore,
  });

  return {
    trustScore,
    contributionScore,
    fraudScore,
    overallScore,
    factors: {
      verificationRate: clamp01(input.signals.verificationRate ?? ReputationDefaults.baselineTrust),
      activityVolume: clamp01(input.signals.activityVolume ?? 0),
      peerRating: clamp01(input.signals.peerRating ?? ReputationDefaults.baselineTrust),
      longevity: clamp01(input.signals.longevity ?? 0.4),
      incidentRate: clamp01(input.signals.incidentRate ?? 0),
    },
  };
}

/** Trend of overall score across history points (positive = improving). */
export function calculateHistoricalTrend(
  scores: number[],
): { delta: number; direction: "up" | "down" | "flat"; average: number } {
  if (scores.length === 0) return { delta: 0, direction: "flat", average: 0 };
  const average = Number(
    (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(3),
  );
  if (scores.length === 1) return { delta: 0, direction: "flat", average };
  const delta = Number((scores[scores.length - 1]! - scores[0]!).toFixed(3));
  const direction = Math.abs(delta) < 0.02 ? "flat" : delta > 0 ? "up" : "down";
  return { delta, direction, average };
}

export function buildLeaderboard(
  profiles: Array<{
    id: string;
    subjectType: string;
    subjectId: string;
    label: string | null;
    overallScore: number;
    trustScore: number;
    status: string;
  }>,
  opts?: { subjectType?: string; limit?: number },
): Array<{
  rank: number;
  id: string;
  subjectType: string;
  subjectId: string;
  label: string | null;
  overallScore: number;
  trustScore: number;
}> {
  const filtered = profiles
    .filter((p) => p.status !== "suspended")
    .filter((p) => (opts?.subjectType ? p.subjectType === opts.subjectType : true))
    .sort((a, b) => b.overallScore - a.overallScore || b.trustScore - a.trustScore);

  const limit = opts?.limit ?? ReputationDefaults.leaderboardLimit;
  return filtered.slice(0, limit).map((p, i) => ({
    rank: i + 1,
    id: p.id,
    subjectType: p.subjectType,
    subjectId: p.subjectId,
    label: p.label,
    overallScore: p.overallScore,
    trustScore: p.trustScore,
  }));
}
