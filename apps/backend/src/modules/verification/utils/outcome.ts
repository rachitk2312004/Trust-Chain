import { VerificationOutcomes } from "@trustchain/config";
import type { VerificationCheck, VerificationOutcome } from "../types/verification.types.js";

const PRECEDENCE: VerificationOutcome[] = [
  VerificationOutcomes.missing,
  VerificationOutcomes.tampered,
  VerificationOutcomes.revoked,
  VerificationOutcomes.expired,
  VerificationOutcomes.invalid,
  VerificationOutcomes.valid,
];

/** Derive external outcome from checks using fixed precedence. */
export function resolveOutcome(checks: VerificationCheck[]): {
  outcome: VerificationOutcome;
  failureReasons: string[];
} {
  const failures = checks.filter((c) => !c.passed);
  const failureReasons = failures.map((c) => c.code ?? c.name);

  const has = (code: string) => failures.some((c) => c.code === code || c.name === code);

  let outcome: VerificationOutcome = VerificationOutcomes.valid;
  if (
    has("version_missing") ||
    has("document_missing") ||
    has("anchor_missing") ||
    has("r2_missing")
  ) {
    outcome = VerificationOutcomes.missing;
  } else if (
    has("hash_tampered") ||
    has("r2_hash_mismatch") ||
    has("anchor_hash_mismatch") ||
    has("chain_hash_mismatch")
  ) {
    outcome = VerificationOutcomes.tampered;
  } else if (has("revoked")) {
    outcome = VerificationOutcomes.revoked;
  } else if (has("document_expired")) {
    outcome = VerificationOutcomes.expired;
  } else if (failures.length > 0) {
    outcome = VerificationOutcomes.invalid;
  }

  // Ensure precedence if multiple categories somehow overlap
  for (const candidate of PRECEDENCE) {
    if (outcome === candidate) break;
  }

  return { outcome, failureReasons };
}
