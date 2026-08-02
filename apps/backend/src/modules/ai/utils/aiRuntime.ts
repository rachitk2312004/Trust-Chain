/**
 * Phase 2 Step 6 — AI runtime configuration.
 * Production must never silently fall back to memory/stub clients.
 */
import { AppError } from "../../../lib/errors.js";

export function isAiProductionMode(): boolean {
  const nodeEnv = (process.env.NODE_ENV ?? "").toLowerCase();
  const explicit = (process.env.AI_EXECUTION_MODE ?? "").toLowerCase();
  if (explicit === "production" || explicit === "gateway") return true;
  if (explicit === "development" || explicit === "test" || explicit === "ci") return false;
  return nodeEnv === "production";
}

export function allowMemoryExecutionClient(): boolean {
  if (isAiProductionMode()) return false;
  const flag = (process.env.AI_EXECUTION_ALLOW_MEMORY ?? "true").toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

export function allowStubAdapterFallback(): boolean {
  if (isAiProductionMode()) return false;
  const flag = (process.env.AI_ALLOW_STUB_FALLBACK ?? "true").toLowerCase();
  return flag === "true" || flag === "1" || flag === "yes";
}

/** Fail immediately in production when gateway prerequisites are missing. */
export function assertAiProductionConfig(): void {
  if (!isAiProductionMode()) return;
  const missing: string[] = [];
  if (!process.env.AI_SERVICE_URL?.trim()) missing.push("AI_SERVICE_URL");
  if (!process.env.AI_SERVICE_TOKEN?.trim()) missing.push("AI_SERVICE_TOKEN");
  // Queue configuration: Redis URL or explicit in-process queue opt-in for managed workers.
  const queueConfigured =
    Boolean(process.env.REDIS_URL?.trim()) ||
    (process.env.AI_QUEUE_BACKEND ?? "").toLowerCase() === "memory";
  if (!queueConfigured) missing.push("REDIS_URL|AI_QUEUE_BACKEND");
  if (missing.length > 0) {
    throw new Error(
      `AI production configuration incomplete: ${missing.join(", ")}. Refusing to start.`,
    );
  }
}

export function requireGatewayOrThrow(): void {
  if (!process.env.AI_SERVICE_URL?.trim()) {
    if (isAiProductionMode() || !allowMemoryExecutionClient()) {
      throw new AppError(
        503,
        "AI_SERVICE_UNAVAILABLE",
        "AI_SERVICE_URL is required for AI execution",
      );
    }
  }
}
