import assert from "node:assert/strict";
import {
  calculateAchievedRpoMinutes,
  createBackupRecord,
  isRpoWithinTarget,
  shouldScheduleBackup,
} from "../recovery.backup.js";
import {
  buildFailbackPlan,
  calculateAchievedRtoMinutes,
  calculateContinuityScore,
  executeFailbackSteps,
  validateRestoreCandidate,
} from "../recovery.restore.js";
import { AppError } from "../../../lib/errors.js";

export function testBackupCreation(): void {
  const record = createBackupRecord({
    organizationId: "org-1",
    policy: {
      id: "p1",
      frequency: "daily",
      rpoMinutes: 60,
      rtoMinutes: 240,
      retentionDays: 30,
      regionCode: "eu-west-1",
      scopes: ["database", "documents"],
      enabled: true,
    },
    now: new Date("2026-08-04T00:00:00.000Z"),
  });
  assert.equal(record.checksumSha256.length, 64);
  assert.ok(record.sizeBytes > 0);
  assert.equal(record.regionCode, "eu-west-1");
  assert.equal(record.expiresAt.toISOString(), "2026-09-03T00:00:00.000Z");

  assert.equal(
    shouldScheduleBackup({
      frequency: "hourly",
      lastBackupCompletedAt: "2026-08-04T00:00:00.000Z",
      now: new Date("2026-08-04T00:30:00.000Z"),
    }),
    false,
  );
  assert.equal(
    shouldScheduleBackup({
      frequency: "hourly",
      lastBackupCompletedAt: "2026-08-04T00:00:00.000Z",
      now: new Date("2026-08-04T01:01:00.000Z"),
    }),
    true,
  );
}

export function testRestoreValidation(): void {
  const ok = validateRestoreCandidate({
    backup: {
      id: "b1",
      status: "completed",
      checksumSha256: "a".repeat(64),
      sizeBytes: 1200,
      regionCode: "eu-west-1",
      expiresAt: "2026-09-01T00:00:00.000Z",
      scopes: ["database"],
    },
    targetRegionCode: "eu-west-1",
    rtoMinutesTarget: 240,
    now: new Date("2026-08-04T00:00:00.000Z"),
  });
  assert.equal(ok.valid, true);

  const bad = validateRestoreCandidate({
    backup: {
      id: "b2",
      status: "failed",
      checksumSha256: null,
      sizeBytes: 0,
      regionCode: "eu-west-1",
      expiresAt: "2026-01-01T00:00:00.000Z",
      scopes: [],
    },
    targetRegionCode: "us-east-1",
    allowedRegions: ["eu-west-1"],
    rtoMinutesTarget: 30,
    now: new Date("2026-08-04T00:00:00.000Z"),
  });
  assert.equal(bad.valid, false);
  assert.ok(bad.reasons.includes("backup_not_completed"));
  assert.ok(bad.reasons.includes("backup_expired"));
}

export function testFailbackProcedures(): void {
  const plan = buildFailbackPlan({
    fromRegionCode: "us-east-1",
    toRegionCode: "eu-west-1",
  });
  assert.equal(plan.length, 5);
  const executed = executeFailbackSteps(plan);
  assert.equal(executed.completed, true);
  assert.ok(executed.steps.every((s) => s.status === "completed"));

  assert.throws(
    () => buildFailbackPlan({ fromRegionCode: "eu-west-1", toRegionCode: "eu-west-1" }),
    (err: unknown) => err instanceof AppError,
  );
}

export function testRpoCalculations(): void {
  const achieved = calculateAchievedRpoMinutes(
    "2026-08-04T00:00:00.000Z",
    new Date("2026-08-04T00:45:00.000Z"),
  );
  assert.equal(achieved, 45);
  assert.equal(isRpoWithinTarget(45, 60), true);
  assert.equal(isRpoWithinTarget(90, 60), false);
  assert.equal(isRpoWithinTarget(null, 60), false);
}

export function testRtoCalculations(): void {
  const rto = calculateAchievedRtoMinutes({
    restoreStartedAt: "2026-08-04T00:00:00.000Z",
    restoreCompletedAt: "2026-08-04T02:30:00.000Z",
  });
  assert.equal(rto, 150);

  const score = calculateContinuityScore({
    rpoMet: true,
    rtoMet: true,
    successfulBackupsLast7d: 7,
    failedBackupsLast7d: 0,
    hasFailbackPlan: true,
  });
  assert.equal(score.score, 1);
}
