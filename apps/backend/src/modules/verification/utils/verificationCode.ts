import { randomBytes } from "node:crypto";

/** Human-readable verification identifier: VERIFY-YYYYMMDD-XXXXXXXX */
export function generateVerificationCode(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `VERIFY-${y}${m}${d}-${suffix}`;
}
