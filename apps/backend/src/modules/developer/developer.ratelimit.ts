import { DeveloperRateLimits } from "@trustchain/config";
import { assertRateLimit } from "../../lib/rateLimit.js";
import {
  defaultApiKeyRateLimit,
  parseRateLimitConfig,
  type ApiKeyRateLimitConfig,
} from "./developer.keys.js";

export async function assertDeveloperKeyCreateLimit(organizationId: string): Promise<void> {
  await assertRateLimit({
    key: `developer:keys:create:${organizationId}`,
    maxRequests: DeveloperRateLimits.keyCreatePerOrg.maxRequests,
    windowMs: DeveloperRateLimits.keyCreatePerOrg.windowMs,
    errorCode: "DEVELOPER_RATE_LIMITED",
    message: "API key creation rate limit exceeded",
  });
}

export async function assertDeveloperWebhookCreateLimit(organizationId: string): Promise<void> {
  await assertRateLimit({
    key: `developer:webhooks:create:${organizationId}`,
    maxRequests: DeveloperRateLimits.webhookCreatePerOrg.maxRequests,
    windowMs: DeveloperRateLimits.webhookCreatePerOrg.windowMs,
    errorCode: "DEVELOPER_RATE_LIMITED",
    message: "Webhook creation rate limit exceeded",
  });
}

export async function assertDeveloperServiceAccountCreateLimit(
  organizationId: string,
): Promise<void> {
  await assertRateLimit({
    key: `developer:service-accounts:create:${organizationId}`,
    maxRequests: DeveloperRateLimits.serviceAccountCreatePerOrg.maxRequests,
    windowMs: DeveloperRateLimits.serviceAccountCreatePerOrg.windowMs,
    errorCode: "DEVELOPER_RATE_LIMITED",
    message: "Service account creation rate limit exceeded",
  });
}

/**
 * Foundation helper for future public API request throttling by API key id.
 * Not wired to public routes in Step 1.
 */
export async function assertApiKeyRequestLimit(
  apiKeyId: string,
  config?: Partial<ApiKeyRateLimitConfig> | null,
): Promise<void> {
  const resolved = defaultApiKeyRateLimit(config ? parseRateLimitConfig(config) : null);
  await assertRateLimit({
    key: `developer:api-key:${apiKeyId}`,
    maxRequests: resolved.maxRequests,
    windowMs: resolved.windowMs,
    errorCode: "API_KEY_RATE_LIMITED",
    message: "API key rate limit exceeded",
  });
}

export function buildRateLimitBucketKey(kind: string, subjectId: string): string {
  return `developer:${kind}:${subjectId}`;
}
