import { AppError } from "../../../lib/errors.js";

export const FORBIDDEN_OPS_OPERATIONS = [
  "autonomous_administration",
  "automatic_policy_enforcement",
  "autonomous_billing",
  "blockchain_modification",
  "mutate_verification",
  "alter_audit_records",
  "modify_cryptographic_evidence",
] as const;

export function assertSafeOpsOperation(operation: string): void {
  const normalized = operation
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if ((FORBIDDEN_OPS_OPERATIONS as readonly string[]).includes(normalized)) {
    throw new AppError(403, "OPS_FORBIDDEN_OPERATION", "Wave 10 must not perform this operation", {
      operation: normalized,
    });
  }
}

export function assertEvidenceImmutable(): never {
  throw new AppError(403, "EVIDENCE_IMMUTABLE", "Evidence records are append-only and immutable");
}
