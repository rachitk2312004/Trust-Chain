/**
 * Fail-fast startup checks for required secrets.
 * PUBLIC_VERIFY_SIGNING_SECRET must never fall back to another secret.
 */
import { assertAiProductionConfig } from "../modules/ai/utils/aiRuntime.js";

export function assertRequiredRuntimeSecrets(): void {
  const missing: string[] = [];
  if (!process.env.PUBLIC_VERIFY_SIGNING_SECRET?.trim()) {
    missing.push("PUBLIC_VERIFY_SIGNING_SECRET");
  }
  if (!process.env.JWT_ACCESS_SECRET?.trim()) {
    missing.push("JWT_ACCESS_SECRET");
  }
  if (!process.env.DATABASE_URL?.trim()) {
    missing.push("DATABASE_URL");
  }
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. Refusing to start.`,
    );
  }
  assertAiProductionConfig();
}

export function getPublicVerifySigningSecret(): string {
  const secret = process.env.PUBLIC_VERIFY_SIGNING_SECRET?.trim();
  if (!secret) {
    throw new Error("PUBLIC_VERIFY_SIGNING_SECRET is required");
  }
  return secret;
}
