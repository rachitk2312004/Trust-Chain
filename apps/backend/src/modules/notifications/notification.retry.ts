import { NotificationDeliveryDefaults } from "@trustchain/config";

export type RetryDecision =
  | { action: "retry"; nextAttempt: number; scheduledAt: Date; backoffMs: number }
  | { action: "dead_letter"; nextAttempt: number; reason: string };

const PERMANENT_PATTERNS = [
  /invalid.?email/i,
  /recipient[_ ].*not[_ ]found/i,
  /missing_email/i,
  /user[_ ].*not[_ ]found/i,
  /mailbox.*unavailable/i,
  /550\b/,
  /551\b/,
  /553\b/,
  /permanent/i,
  /unsubscribe/i,
  /blocked.*recipient/i,
  /unsupported_channel/i,
];

export function isPermanentDeliveryFailure(error: string): boolean {
  return PERMANENT_PATTERNS.some((re) => re.test(error));
}

export function computeBackoffMs(
  attempts: number,
  baseMs = NotificationDeliveryDefaults.baseBackoffMs,
  maxMs = NotificationDeliveryDefaults.maxBackoffMs,
): number {
  const exp = Math.max(0, attempts - 1);
  return Math.min(baseMs * 2 ** exp, maxMs);
}

/**
 * Decide whether to schedule a retry or move to dead_letter.
 * `attempts` is the count AFTER the failed attempt was recorded.
 */
export function decideRetry(input: {
  attempts: number;
  error: string;
  maxAttempts?: number;
  now?: Date;
}): RetryDecision {
  const maxAttempts = input.maxAttempts ?? NotificationDeliveryDefaults.maxAttempts;
  const nextAttempt = input.attempts;

  if (isPermanentDeliveryFailure(input.error)) {
    return {
      action: "dead_letter",
      nextAttempt,
      reason: `permanent_failure: ${input.error}`,
    };
  }

  if (nextAttempt >= maxAttempts) {
    return {
      action: "dead_letter",
      nextAttempt,
      reason: `max_attempts_reached: ${input.error}`,
    };
  }

  const backoffMs = computeBackoffMs(nextAttempt);
  const now = input.now ?? new Date();
  return {
    action: "retry",
    nextAttempt,
    scheduledAt: new Date(now.getTime() + backoffMs),
    backoffMs,
  };
}
