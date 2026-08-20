import assert from "node:assert/strict";
import { assessFraud, calculateFraudScore, detectAnomaly } from "../reputation.fraud.js";
import {
  buildLeaderboard,
  calculateContributionScore,
  calculateHistoricalTrend,
  calculateTrustScore,
  scoreReputation,
} from "../reputation.scoring.js";

export function testTrustScoring(): void {
  const high = calculateTrustScore({
    verificationRate: 1,
    peerRating: 1,
    longevity: 1,
    incidentRate: 0,
  });
  assert.ok(high >= 0.9);

  const low = calculateTrustScore({
    verificationRate: 0.1,
    peerRating: 0.1,
    longevity: 0.1,
    incidentRate: 0.9,
  });
  assert.ok(low < 0.4);

  const contrib = calculateContributionScore({
    activityVolume: 0.8,
    peerRating: 0.6,
    longevity: 0.4,
  });
  assert.ok(contrib > 0.5 && contrib <= 1);

  const scored = scoreReputation({
    subjectType: "wallet",
    signals: {
      verificationRate: 0.9,
      activityVolume: 0.5,
      peerRating: 0.8,
      longevity: 0.7,
      incidentRate: 0.1,
    },
    fraudScore: 0.1,
  });
  assert.ok(scored.overallScore > 0.4);
  assert.equal(scored.fraudScore, 0.1);
}

export function testAnomalyDetection(): void {
  const stable = detectAnomaly({
    historyScores: [0.5, 0.51, 0.49, 0.5, 0.52],
    latestScore: 0.5,
  });
  assert.equal(stable.anomalous, false);

  const spike = detectAnomaly({
    historyScores: [0.5, 0.51, 0.49, 0.5, 0.52],
    latestScore: 0.95,
    threshold: 2,
  });
  assert.equal(spike.anomalous, true);
  assert.ok(Math.abs(spike.zScore) >= 2);
}

export function testFraudDetection(): void {
  const low = calculateFraudScore({ scoreVelocity: 0.1, denylistHit: 0 });
  assert.ok(low < 0.3);

  const high = assessFraud({
    fraudSignals: {
      scoreVelocity: 0.9,
      identityCollisions: 4,
      failedVerificationBurst: 0.8,
      burstActivity: 0.8,
      denylistHit: 0.7,
    },
    historyScores: [0.5, 0.5, 0.51, 0.49],
    latestOverallScore: 0.2,
  });
  assert.equal(high.flagged, true);
  assert.ok(high.fraudScore >= 0.65);
  assert.ok(high.reasons.length >= 2);
  assert.ok(["flagged", "suspended", "watched"].includes(high.suggestedStatus));
}

export function testHistoricalCalculations(): void {
  const up = calculateHistoricalTrend([0.4, 0.45, 0.5, 0.6]);
  assert.equal(up.direction, "up");
  assert.ok(up.delta > 0);

  const flat = calculateHistoricalTrend([0.5, 0.51, 0.5]);
  assert.equal(flat.direction, "flat");

  const down = calculateHistoricalTrend([0.8, 0.6, 0.4]);
  assert.equal(down.direction, "down");
}

export function testLeaderboardGeneration(): void {
  const board = buildLeaderboard(
    [
      {
        id: "1",
        subjectType: "user",
        subjectId: "u1",
        label: "Alice",
        overallScore: 0.9,
        trustScore: 0.9,
        status: "active",
      },
      {
        id: "2",
        subjectType: "user",
        subjectId: "u2",
        label: "Bob",
        overallScore: 0.7,
        trustScore: 0.8,
        status: "active",
      },
      {
        id: "3",
        subjectType: "wallet",
        subjectId: "w1",
        label: "Wallet",
        overallScore: 0.95,
        trustScore: 0.9,
        status: "active",
      },
      {
        id: "4",
        subjectType: "user",
        subjectId: "u3",
        label: "Bad",
        overallScore: 0.99,
        trustScore: 0.99,
        status: "suspended",
      },
    ],
    { subjectType: "user", limit: 10 },
  );
  assert.equal(board.length, 2);
  assert.equal(board[0]!.label, "Alice");
  assert.equal(board[0]!.rank, 1);
  assert.equal(board[1]!.rank, 2);
}
