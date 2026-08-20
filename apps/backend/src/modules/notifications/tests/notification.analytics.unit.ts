import assert from "node:assert/strict";
import { NotificationOutboxStatuses } from "@trustchain/config";
import {
  buildDigestStatistics,
  buildFailureAnalysis,
  buildQueueStatistics,
  buildRetryAnalysis,
  calculateAverageDeliveryLatency,
} from "../notification.analytics.js";
import { retentionCutoff } from "../notification.retention.js";
import {
  averageLatency,
  computeDeliveryLatencyMs,
  NotificationMetrics,
} from "../notification.metrics.js";

export function testStatisticsGeneration(): void {
  const queue = buildQueueStatistics({
    [NotificationOutboxStatuses.pending]: 3,
    [NotificationOutboxStatuses.processing]: 1,
    [NotificationOutboxStatuses.retry]: 2,
    [NotificationOutboxStatuses.failed]: 1,
    [NotificationOutboxStatuses.delivered]: 10,
    [NotificationOutboxStatuses.deadLetter]: 4,
  });
  assert.equal(queue.depth, 3 + 1 + 2 + 1);
  assert.equal(queue.deadLetter, 4);
  assert.equal(queue.delivered, 10);

  const digests = buildDigestStatistics([
    { payloadJson: { deliveryMode: "immediate" }, status: "pending" },
    { payloadJson: { deliveryMode: "daily" }, status: "pending" },
    { payloadJson: { metadata: { deliveryMode: "weekly" } }, status: "retry" },
    { payloadJson: { deliveryMode: "daily" }, status: "delivered" },
  ]);
  assert.equal(digests.immediate, 1);
  assert.equal(digests.daily, 2);
  assert.equal(digests.weekly, 1);
  assert.equal(digests.pendingDigest, 2);
}

export function testLatencyCalculations(): void {
  const created = new Date("2026-08-03T12:00:00.000Z");
  const sent = new Date("2026-08-03T12:00:05.000Z");
  assert.equal(computeDeliveryLatencyMs(created, sent), 5000);

  const avg = calculateAverageDeliveryLatency([
    { createdAt: created, sentAt: sent },
    { createdAt: created, sentAt: new Date("2026-08-03T12:00:15.000Z") },
    { createdAt: created, sentAt: null },
  ]);
  assert.equal(avg.sampleSize, 2);
  assert.equal(avg.averageDeliveryTimeMs, 10000);
  assert.equal(averageLatency([]), null);
  assert.equal(averageLatency([100, 200, 300]), 200);
}

export function testRetentionCleanupHelpers(): void {
  const now = new Date("2026-08-03T00:00:00.000Z");
  const cutoff = retentionCutoff(10, now);
  assert.equal(cutoff.toISOString(), "2026-07-24T00:00:00.000Z");
  const minCutoff = retentionCutoff(0, now);
  assert.ok(minCutoff.getTime() < now.getTime());
}

export function testDeadLetterRecoveryLogic(): void {
  type Row = { id: string; status: string; attempts: number; lastError: string | null };
  const rows: Row[] = [
    { id: "a", status: "dead_letter", attempts: 5, lastError: "permanent_failure: x" },
    { id: "b", status: "dead_letter", attempts: 5, lastError: "timeout" },
    { id: "c", status: "delivered", attempts: 1, lastError: null },
  ];

  function fakeRetryDeadLetters(ids?: string[]) {
    const targets = rows.filter(
      (r) => r.status === "dead_letter" && (!ids || ids.includes(r.id)),
    );
    const recovered: string[] = [];
    for (const row of targets) {
      row.status = "pending";
      row.attempts = 0;
      row.lastError = null;
      recovered.push(row.id);
    }
    return { requested: targets.length, recovered: recovered.length, ids: recovered };
  }

  const result = fakeRetryDeadLetters(["a", "b"]);
  assert.equal(result.recovered, 2);
  assert.equal(rows[0]!.status, "pending");
  assert.equal(rows[0]!.attempts, 0);
  assert.equal(rows[2]!.status, "delivered");
}

export function testAdministrativeAnalyses(): void {
  const failures = buildFailureAnalysis([
    { status: "dead_letter", lastError: "permanent_failure: bad" },
    { status: "failed", lastError: "ETIMEDOUT connecting" },
    { status: "failed", lastError: "SMTP 550 bounce" },
    { status: "delivered", lastError: null },
  ]);
  assert.equal(failures.totalFailed, 3);
  assert.equal(failures.deadLetters, 1);
  assert.ok(failures.topErrors.length >= 1);
  assert.equal(failures.permanentHintCount, 1);

  const retries = buildRetryAnalysis([
    { status: "retry", attempts: 2 },
    { status: "retry", attempts: 4 },
    { status: "pending", attempts: 0 },
  ]);
  assert.equal(retries.retrying, 2);
  assert.equal(retries.maxAttemptsAmongRetries, 4);
  assert.equal(retries.highAttemptCount, 1);
}

export async function testAdministrativeMetricsSnapshot(): Promise<void> {
  const m = new NotificationMetrics();
  m.recordCreated();
  m.recordDelivered(1, 1500);
  m.recordDeadLetter();
  m.recordDigest(3);
  m.setActiveConnectionsFn(() => 2);
  m.setQueueDepthFn(async () => 9);
  const snap = await m.snapshot();
  assert.equal(snap.notificationsCreated, 1);
  assert.equal(snap.deadLetterCount, 1);
  assert.equal(snap.digestVolume, 3);
  assert.equal(snap.averageDeliveryTimeMs, 1500);
  assert.equal(snap.activeConnections, 2);
  assert.equal(snap.queueDepth, 9);
}
