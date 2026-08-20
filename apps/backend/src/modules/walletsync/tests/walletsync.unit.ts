import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  buildOwnershipReport,
  buildSyncPlan,
  executeSyncPlan,
  shouldScheduleSync,
} from "../walletsync.jobs.js";
import {
  detectLinkConflict,
  generateOwnershipChallenge,
  normalizeWalletAddress,
  resolveLinkConflict,
  verifyOwnershipProof,
} from "../walletsync.verification.js";
import { AppError } from "../../../lib/errors.js";

export function testWalletLinking(): void {
  const eth = normalizeWalletAddress(
    "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
    "metamask",
  );
  assert.equal(eth, "0xabcdef1234567890abcdef1234567890abcdef12");

  const sol = normalizeWalletAddress(
    "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
    "phantom",
  );
  assert.ok(sol.length >= 32);

  assert.throws(
    () => normalizeWalletAddress("not-an-address", "metamask"),
    (err: unknown) => err instanceof AppError,
  );

  const conflict = detectLinkConflict({
    existingOwnerUserId: "user-a",
    requestingUserId: "user-b",
    existingStatus: "verified",
  });
  assert.equal(conflict.hasConflict, true);
  assert.equal(resolveLinkConflict(conflict).allow, false);
}

export function testChallengeGeneration(): void {
  const challenge = generateOwnershipChallenge({
    organizationId: "11111111-1111-1111-1111-111111111111",
    userId: "22222222-2222-2222-2222-222222222222",
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider: "coinbase",
    now: new Date("2026-08-04T00:00:00.000Z"),
    ttlSeconds: 600,
  });
  assert.equal(challenge.nonce.length, 32);
  assert.ok(challenge.message.includes("TrustChain wallet ownership"));
  assert.equal(challenge.expectedProof.length, 64);
  assert.equal(challenge.expiresAt.toISOString(), "2026-08-04T00:10:00.000Z");
}

export function testOwnershipVerification(): void {
  const challenge = generateOwnershipChallenge({
    organizationId: "org",
    userId: "user",
    address: "0xabcdef1234567890abcdef1234567890abcdef12",
    provider: "walletconnect",
    now: new Date("2026-08-04T00:00:00.000Z"),
  });
  const proof = createHash("sha256").update(challenge.message, "utf8").digest("hex");
  const ok = verifyOwnershipProof({
    message: challenge.message,
    expectedProof: challenge.expectedProof,
    providedProof: proof,
    expiresAt: challenge.expiresAt,
    now: new Date("2026-08-04T00:05:00.000Z"),
  });
  assert.equal(ok.valid, true);

  const expired = verifyOwnershipProof({
    message: challenge.message,
    expectedProof: challenge.expectedProof,
    providedProof: proof,
    expiresAt: challenge.expiresAt,
    now: new Date("2026-08-04T00:20:00.000Z"),
  });
  assert.equal(expired.valid, false);
  assert.ok(expired.reasons.includes("challenge_expired"));

  const bad = verifyOwnershipProof({
    message: challenge.message,
    expectedProof: challenge.expectedProof,
    providedProof: "deadbeef",
    expiresAt: challenge.expiresAt,
    now: new Date("2026-08-04T00:01:00.000Z"),
  });
  assert.equal(bad.valid, false);
}

export function testSynchronization(): void {
  assert.equal(
    shouldScheduleSync({
      lastSyncedAt: "2026-08-04T00:00:00.000Z",
      intervalMinutes: 60,
      now: new Date("2026-08-04T00:30:00.000Z"),
    }),
    false,
  );
  assert.equal(
    shouldScheduleSync({
      lastSyncedAt: "2026-08-04T00:00:00.000Z",
      intervalMinutes: 60,
      now: new Date("2026-08-04T01:01:00.000Z"),
    }),
    true,
  );

  const plan = buildSyncPlan({
    wallets: [
      {
        id: "w1",
        address: "0xabc",
        provider: "metamask",
        status: "verified",
        lastSyncedAt: null,
      },
      {
        id: "w2",
        address: "0xdef",
        provider: "phantom",
        status: "conflict",
        lastSyncedAt: null,
      },
      {
        id: "w3",
        address: "0xghi",
        provider: "coinbase",
        status: "revoked",
        lastSyncedAt: null,
      },
    ],
    now: new Date("2026-08-04T00:00:00.000Z"),
  });
  const result = executeSyncPlan(plan);
  assert.equal(result.synced, 1);
  assert.equal(result.conflicts, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.status, "completed");
}

export function testConflictResolution(): void {
  const same = detectLinkConflict({
    existingOwnerUserId: "u1",
    requestingUserId: "u1",
    existingStatus: "pending",
  });
  assert.equal(same.hasConflict, false);

  const reclaim = detectLinkConflict({
    existingOwnerUserId: "u1",
    requestingUserId: "u2",
    existingStatus: "revoked",
  });
  assert.equal(reclaim.resolution, "reassign");
  assert.equal(resolveLinkConflict(reclaim).action, "reassign");

  const blocked = detectLinkConflict({
    existingOwnerUserId: "u1",
    requestingUserId: "u2",
    existingStatus: "verified",
  });
  assert.equal(resolveLinkConflict(blocked).action, "reject");

  const report = buildOwnershipReport({
    wallets: [
      { status: "verified", isPrimary: true, provider: "metamask" },
      { status: "pending", isPrimary: false, provider: "phantom" },
      { status: "conflict", isPrimary: false, provider: "metamask" },
    ],
    eventsCount: 3,
  });
  assert.equal(report.total, 3);
  assert.equal(report.verified, 1);
  assert.equal(report.conflicted, 1);
  assert.equal(report.providers.metamask, 2);
}
