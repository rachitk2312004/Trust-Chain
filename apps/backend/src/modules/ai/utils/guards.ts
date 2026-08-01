import { AppError } from "../../../lib/errors.js";

/** Operations AI must never perform. */
export const FORBIDDEN_AI_OPERATIONS = [
  "revoke",
  "blockchain_tx",
  "mutate_verification",
  "autonomous_agent",
  "self_modify_prompt",
  "automated_revocation",
  "automated_blockchain_transaction",
] as const;

export type ForbiddenAiOperation = (typeof FORBIDDEN_AI_OPERATIONS)[number];

export function assertSafeAiOperation(operation: string): void {
  const normalized = operation
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if ((FORBIDDEN_AI_OPERATIONS as readonly string[]).includes(normalized)) {
    throw new AppError(403, "AI_FORBIDDEN_OPERATION", "AI must not perform this operation", {
      operation: normalized,
    });
  }
}

/** Hard guard: AI responses are advisory and never authoritative trust outcomes. */
export const AI_ADVISORY_DISCLAIMER =
  "AI output is advisory only. Wave 4/5 verification reports, blockchain anchors, PostgreSQL metadata, R2 bytes, and audit logs remain the sources of truth.";
