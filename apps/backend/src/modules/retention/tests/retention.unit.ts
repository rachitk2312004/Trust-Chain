import assert from "node:assert/strict";
import {
  createArchiveRecord,
  markArchivePurged,
  summarizeRetentionReport,
} from "../retention.archive.js";
import {
  buildCustodyIntegrityHash,
  canPurgeTarget,
  computeExpiresAt,
  evaluateDisposition,
  isExpired,
  isUnderLegalHold,
  selectPolicyForTarget,
  verifyRetentionChain,
} from "../retention.scheduler.js";

export function testPolicyEvaluation(): void {
  const policies = [
    {
      id: "p2",
      targetType: "document",
      retentionDays: 90,
      disposition: "archive",
      status: "active",
      priority: 200,
    },
    {
      id: "p1",
      targetType: "document",
      retentionDays: 30,
      disposition: "purge",
      status: "active",
      priority: 10,
    },
    {
      id: "p3",
      targetType: "document",
      retentionDays: 7,
      disposition: "archive",
      status: "disabled",
      priority: 1,
    },
  ];
  const selected = selectPolicyForTarget(policies, "document");
  assert.equal(selected?.id, "p1");

  const createdAt = new Date("2020-01-01T00:00:00.000Z");
  const expires = computeExpiresAt(createdAt, 30);
  assert.ok(expires.getTime() > createdAt.getTime());
  assert.equal(
    isExpired({ targetType: "document", targetId: "d1", createdAt }, 30, new Date("2020-02-15T00:00:00.000Z")),
    true,
  );
  assert.equal(
    isExpired({ targetType: "document", targetId: "d1", createdAt }, 30, new Date("2020-01-15T00:00:00.000Z")),
    false,
  );

  const decision = evaluateDisposition({
    candidate: { targetType: "document", targetId: "d1", createdAt },
    policy: selected,
    holds: [],
    now: new Date("2020-03-01T00:00:00.000Z"),
  });
  assert.equal(decision.action, "archive");
}

export function testHoldEnforcement(): void {
  const holds = [
    {
      id: "h1",
      status: "active",
      scope: "targets",
      targetType: "document",
      targetIds: ["doc-held"],
      startsAt: "2019-01-01T00:00:00.000Z",
      endsAt: null,
    },
  ];
  assert.equal(isUnderLegalHold(holds, "document", "doc-held"), true);
  assert.equal(isUnderLegalHold(holds, "document", "doc-free"), false);

  const decision = evaluateDisposition({
    candidate: {
      targetType: "document",
      targetId: "doc-held",
      createdAt: "2018-01-01T00:00:00.000Z",
    },
    policy: {
      id: "p1",
      targetType: "document",
      retentionDays: 30,
      disposition: "purge",
      status: "active",
      priority: 1,
    },
    holds,
    now: new Date("2020-01-01T00:00:00.000Z"),
  });
  assert.equal(decision.action, "skip");
  assert.equal(decision.reason, "hold_blocked");
}

export function testArchivalLogic(): void {
  const record = createArchiveRecord({
    organizationId: "org-1",
    candidate: {
      targetType: "evidence",
      targetId: "ev-1",
      createdAt: "2020-01-01T00:00:00.000Z",
    },
    fields: { title: "Access review" },
    policyId: "p1",
    expiresAt: new Date("2020-02-01T00:00:00.000Z"),
    previousHash: null,
    now: new Date("2020-02-02T00:00:00.000Z"),
  });
  assert.equal(record.status, "archived");
  assert.equal(record.integrityHash.length, 64);
  assert.equal(record.snapshot.targetId, "ev-1");
}

export function testPurgeLogic(): void {
  assert.equal(canPurgeTarget("document"), true);
  assert.equal(canPurgeTarget("audit_event"), false);

  const ok = markArchivePurged({
    targetType: "document",
    archivedStatus: "archived",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.status, "purged");

  const blocked = markArchivePurged({
    targetType: "audit_event",
    archivedStatus: "archived",
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, "immutable_target");

  const hold = markArchivePurged({
    targetType: "document",
    archivedStatus: "archived",
    holdBlocked: true,
  });
  assert.equal(hold.ok, false);

  const decision = evaluateDisposition({
    candidate: {
      targetType: "document",
      targetId: "d1",
      createdAt: "2018-01-01T00:00:00.000Z",
    },
    policy: {
      id: "p1",
      targetType: "document",
      retentionDays: 30,
      disposition: "purge",
      status: "active",
      priority: 1,
    },
    holds: [],
    alreadyArchived: true,
    now: new Date("2020-01-01T00:00:00.000Z"),
  });
  assert.equal(decision.action, "purge");
}

export function testChainVerification(): void {
  const t0 = "2020-01-01T00:00:00.000Z";
  const t1 = "2020-01-02T00:00:00.000Z";
  const firstHash = buildCustodyIntegrityHash({
    organizationId: "org",
    targetType: "document",
    targetId: "d1",
    action: "archived",
    previousHash: null,
    createdAt: t0,
  });
  const secondHash = buildCustodyIntegrityHash({
    organizationId: "org",
    targetType: "document",
    targetId: "d1",
    action: "purged",
    previousHash: firstHash,
    createdAt: t1,
  });

  assert.equal(
    verifyRetentionChain([
      { previousHash: null, integrityHash: firstHash },
      { previousHash: firstHash, integrityHash: secondHash },
    ]),
    true,
  );
  assert.equal(
    verifyRetentionChain([
      { previousHash: null, integrityHash: firstHash },
      { previousHash: "deadbeef", integrityHash: secondHash },
    ]),
    false,
  );

  const report = summarizeRetentionReport({
    archived: 2,
    purged: 1,
    holdBlocked: 1,
    skipped: 3,
    chainValid: true,
  });
  assert.equal(report.processed, 7);
  assert.equal(report.chainValid, true);
}
