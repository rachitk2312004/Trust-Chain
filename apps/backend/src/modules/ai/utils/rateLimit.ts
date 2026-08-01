import { AiRateLimit } from "@trustchain/config";
import { AppError } from "../../../lib/errors.js";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function assertAiRateLimit(key: string): void {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + AiRateLimit.windowMs });
    return;
  }
  if (existing.count >= AiRateLimit.maxRequests) {
    throw new AppError(429, "AI_RATE_LIMITED", "AI rate limit exceeded", {
      retryAfterMs: existing.resetAt - now,
    });
  }
  existing.count += 1;
}

/** Test helper */
export function resetAiRateLimitBuckets(): void {
  buckets.clear();
}
