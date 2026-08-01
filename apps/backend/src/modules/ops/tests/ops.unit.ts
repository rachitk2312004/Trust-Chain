import assert from "node:assert/strict";
import { OpsEntityStates, OpsIdPrefixes } from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";
import {
  assertEvidenceImmutable,
  assertSafeOpsOperation,
  FORBIDDEN_OPS_OPERATIONS,
} from "../utils/guards.js";
import { generateOpsPublicCode } from "../utils/ids.js";
import { computePlatformScores } from "../utils/scoring.js";

export function testOpsPublicCodes(): void {
  assert.match(generateOpsPublicCode("alert"), new RegExp(`^${OpsIdPrefixes.alert}-[0-9A-F]{8}$`));
  assert.match(
    generateOpsPublicCode("report"),
    new RegExp(`^${OpsIdPrefixes.report}-[0-9A-F]{8}$`),
  );
  assert.match(generateOpsPublicCode("case"), new RegExp(`^${OpsIdPrefixes.case}-[0-9A-F]{8}$`));
  assert.match(
    generateOpsPublicCode("policy"),
    new RegExp(`^${OpsIdPrefixes.policy}-[0-9A-F]{8}$`),
  );
  assert.match(
    generateOpsPublicCode("feature"),
    new RegExp(`^${OpsIdPrefixes.feature}-[0-9A-F]{8}$`),
  );
  assert.match(
    generateOpsPublicCode("release"),
    new RegExp(`^${OpsIdPrefixes.release}-[0-9A-F]{8}$`),
  );
  assert.match(
    generateOpsPublicCode("deployment"),
    new RegExp(`^${OpsIdPrefixes.deployment}-[0-9A-F]{8}$`),
  );
}

export function testOpsStatesAndScores(): void {
  assert.equal(OpsEntityStates.active, "active");
  assert.equal(OpsEntityStates.pending, "pending");
  assert.equal(OpsEntityStates.suspended, "suspended");
  const scores = computePlatformScores({ trustScore: 0.9, riskScore: 0.1 });
  assert.equal(scores.trustScore, 0.9);
  assert.equal(scores.riskScore, 0.1);
  assert.ok(scores.healthScore >= 0 && scores.healthScore <= 1);
  assert.ok(scores.complianceScore >= 0 && scores.complianceScore <= 1);
}

export function testForbiddenOpsOperations(): void {
  for (const op of FORBIDDEN_OPS_OPERATIONS) {
    assert.throws(
      () => assertSafeOpsOperation(op),
      (error) => error instanceof AppError && error.code === "OPS_FORBIDDEN_OPERATION",
    );
  }
  assertSafeOpsOperation("create_report");
  assert.throws(
    () => assertEvidenceImmutable(),
    (error) => error instanceof AppError && error.code === "EVIDENCE_IMMUTABLE",
  );
}
