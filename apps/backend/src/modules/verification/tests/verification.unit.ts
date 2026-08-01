import assert from "node:assert/strict";
import { resolveOutcome } from "../utils/outcome.js";
import { generateVerificationCode } from "../utils/verificationCode.js";
import { buildVerificationReport } from "../reports/reportGenerator.js";
import { VerificationInternalStatuses, VerificationOutcomes } from "@trustchain/config";

export function testVerificationCodeFormat() {
  const code = generateVerificationCode(new Date("2026-08-02T12:00:00Z"));
  assert.match(code, /^VERIFY-20260802-[0-9A-F]{8}$/);
}

export function testOutcomePrecedence() {
  const tampered = resolveOutcome([
    { name: "hash_matches", passed: false, code: "hash_tampered" },
    { name: "not_revoked", passed: false, code: "revoked" },
  ]);
  assert.equal(tampered.outcome, VerificationOutcomes.tampered);

  const revoked = resolveOutcome([{ name: "not_revoked", passed: false, code: "revoked" }]);
  assert.equal(revoked.outcome, VerificationOutcomes.revoked);

  const expired = resolveOutcome([
    { name: "document_not_expired", passed: false, code: "document_expired" },
  ]);
  assert.equal(expired.outcome, VerificationOutcomes.expired);

  const missing = resolveOutcome([
    { name: "version_present", passed: false, code: "version_missing" },
  ]);
  assert.equal(missing.outcome, VerificationOutcomes.missing);

  const valid = resolveOutcome([{ name: "hash_matches", passed: true }]);
  assert.equal(valid.outcome, VerificationOutcomes.valid);
}

export function testReportProofFields() {
  const report = buildVerificationReport({
    verificationId: "11111111-1111-1111-1111-111111111111",
    verificationCode: "VERIFY-20260802-ABCD1234",
    organizationId: "22222222-2222-2222-2222-222222222222",
    documentId: "33333333-3333-3333-3333-333333333333",
    versionNumber: 1,
    contentHash: "a".repeat(64),
    blockchainStatus: "anchored",
    revocationStatus: "not_revoked",
    status: VerificationInternalStatuses.completed,
    outcome: VerificationOutcomes.valid,
    failureReasons: [],
    checks: [],
    proofOfIntegrity: "a".repeat(64),
    proofTimestamp: new Date("2026-08-02T00:00:00Z"),
    networkName: "Hardhat",
    transactionHash: "0xabc",
    blockNumber: 12n,
  });

  assert.equal(report.proofOfIntegrity, "a".repeat(64));
  assert.equal(report.networkName, "Hardhat");
  assert.equal(report.transactionHash, "0xabc");
  assert.equal(report.blockNumber, 12);
  assert.equal(report.status, VerificationInternalStatuses.completed);
  assert.equal(report.verificationResult, VerificationOutcomes.valid);
  assert.ok(report.proofTimestamp);
}
