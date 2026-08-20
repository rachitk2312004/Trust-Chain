import {
  DefaultWebhookRetryPolicy,
  DeveloperIdPrefixes,
  WebhookDeliveryStatuses,
  WebhookEndpointStatuses,
} from "@trustchain/config";
import { generateOpaqueToken } from "../../lib/crypto.js";
import { generatePublicCode } from "./developer.keys.js";
import { encryptSigningSecret } from "./developer.signing.js";

export type WebhookRetryPolicy = {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
};

export type GeneratedWebhookSecret = {
  plaintext: string;
  secretHash: string;
  secretPrefix: string;
};

export function defaultRetryPolicy(
  overrides?: Partial<WebhookRetryPolicy> | null,
): WebhookRetryPolicy {
  return {
    maxAttempts: overrides?.maxAttempts ?? DefaultWebhookRetryPolicy.maxAttempts,
    initialDelayMs: overrides?.initialDelayMs ?? DefaultWebhookRetryPolicy.initialDelayMs,
    maxDelayMs: overrides?.maxDelayMs ?? DefaultWebhookRetryPolicy.maxDelayMs,
    backoffMultiplier:
      overrides?.backoffMultiplier ?? DefaultWebhookRetryPolicy.backoffMultiplier,
  };
}

export function parseRetryPolicy(value: unknown): WebhookRetryPolicy {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return defaultRetryPolicy({
    maxAttempts:
      typeof raw.maxAttempts === "number" ? Math.floor(raw.maxAttempts) : undefined,
    initialDelayMs:
      typeof raw.initialDelayMs === "number" ? Math.floor(raw.initialDelayMs) : undefined,
    maxDelayMs: typeof raw.maxDelayMs === "number" ? Math.floor(raw.maxDelayMs) : undefined,
    backoffMultiplier:
      typeof raw.backoffMultiplier === "number" ? raw.backoffMultiplier : undefined,
  });
}

export function normalizeWebhookEvents(events: string[] | undefined | null): string[] {
  const unique = new Set<string>();
  for (const event of events ?? ["*"]) {
    const trimmed = event.trim();
    if (trimmed) unique.add(trimmed);
  }
  if (unique.size === 0) unique.add("*");
  return [...unique].sort();
}

export function generateWebhookSecret(): GeneratedWebhookSecret {
  const plaintext = `whsec_${generateOpaqueToken(24)}`;
  return {
    plaintext,
    /** Recoverable ciphertext stored in secret_hash column for HMAC signing. */
    secretHash: encryptSigningSecret(plaintext),
    secretPrefix: plaintext.slice(0, 12),
  };
}

export function generateWebhookPublicCode(): string {
  return generatePublicCode(DeveloperIdPrefixes.webhook);
}

export function computeNextRetryAt(
  policy: WebhookRetryPolicy,
  attemptCount: number,
  now = new Date(),
): Date | null {
  if (attemptCount >= policy.maxAttempts) return null;
  const delay = Math.min(
    policy.maxDelayMs,
    Math.floor(policy.initialDelayMs * policy.backoffMultiplier ** Math.max(0, attemptCount)),
  );
  return new Date(now.getTime() + delay);
}

export function resolveDeliveryStatusAfterAttempt(input: {
  success: boolean;
  attemptCount: number;
  policy: WebhookRetryPolicy;
}): string {
  if (input.success) return WebhookDeliveryStatuses.success;
  if (input.attemptCount >= input.policy.maxAttempts) return WebhookDeliveryStatuses.failed;
  return WebhookDeliveryStatuses.retrying;
}

export function canManageWebhookStatus(status: string): boolean {
  return (Object.values(WebhookEndpointStatuses) as string[]).includes(status);
}
