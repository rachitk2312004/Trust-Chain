import { DefaultWebhookRetryPolicy } from "@trustchain/config";

export type WebhookRetryPolicy = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

export function parseRetryPolicy(raw: unknown): WebhookRetryPolicy | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const maxAttempts = Number(o.maxAttempts ?? o.max_attempts);
  const initialDelayMs = Number(o.initialDelayMs ?? o.initial_delay_ms);
  const maxDelayMs = Number(o.maxDelayMs ?? o.max_delay_ms);
  const backoffMultiplier = Number(o.backoffMultiplier ?? o.backoff_multiplier);
  if (
    !Number.isFinite(maxAttempts) ||
    !Number.isFinite(initialDelayMs) ||
    !Number.isFinite(maxDelayMs) ||
    !Number.isFinite(backoffMultiplier)
  ) {
    return null;
  }
  return {
    maxAttempts: Math.max(1, Math.floor(maxAttempts)),
    initialDelayMs: Math.max(0, Math.floor(initialDelayMs)),
    maxDelayMs: Math.max(0, Math.floor(maxDelayMs)),
    backoffMultiplier: Math.max(1, backoffMultiplier),
  };
}

/**
 * Exponential backoff: initialDelayMs * (multiplier ^ (attemptCount - 1)), capped at maxDelayMs.
 * attemptCount is 1-based (first failure → attemptCount=1 → delay = initial).
 */
export function nextBackoffMs(attemptCount: number, policy: WebhookRetryPolicy): number {
  const attempt = Math.max(1, attemptCount);
  const raw = policy.initialDelayMs * Math.pow(policy.backoffMultiplier, attempt - 1);
  return Math.min(policy.maxDelayMs, Math.floor(raw));
}

export function shouldDeadLetter(attemptCount: number, policy: WebhookRetryPolicy): boolean {
  return attemptCount >= policy.maxAttempts;
}

export function defaultRetryPolicy(): WebhookRetryPolicy {
  return { ...DefaultWebhookRetryPolicy };
}
