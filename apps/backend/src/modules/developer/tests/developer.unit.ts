import assert from "node:assert/strict";
import {
  ApiKeyScopes,
  ApiKeyStatuses,
  DeveloperRateLimits,
  ServiceAccountStatuses,
  WebhookDeliveryStatuses,
} from "@trustchain/config";
import {
  extractApiKeyFromAuthorization,
  hashDeveloperSecret,
  secretsEqual,
  verifyApiKeyMaterial,
} from "../developer.auth.js";
import {
  canRevokeApiKey,
  canRotateApiKey,
  defaultApiKeyRateLimit,
  generateApiKeyMaterial,
  isApiKeyExpired,
  normalizeScopes,
  resolveApiKeyStatus,
} from "../developer.keys.js";
import { buildRateLimitBucketKey } from "../developer.ratelimit.js";
import {
  computeNextRetryAt,
  defaultRetryPolicy,
  generateWebhookSecret,
  normalizeWebhookEvents,
  resolveDeliveryStatusAfterAttempt,
} from "../developer.webhooks.js";

export function testKeyGeneration(): void {
  const live = generateApiKeyMaterial({ environment: "live" });
  assert.ok(live.plaintext.startsWith("tc_live_"));
  assert.equal(live.keyHash, hashDeveloperSecret(live.plaintext));
  assert.ok(live.keyPrefix.length >= 8);
  assert.ok(live.publicCode.startsWith("KEY-"));

  const test = generateApiKeyMaterial({ environment: "test" });
  assert.ok(test.plaintext.startsWith("tc_test_"));
  assert.ok(verifyApiKeyMaterial(test.plaintext, test.keyHash));
  assert.equal(verifyApiKeyMaterial("wrong", test.keyHash), false);

  assert.deepEqual(normalizeScopes(["write", "read", "write", "unknown"]), ["read", "write"]);
  assert.deepEqual(normalizeScopes([]), [ApiKeyScopes.read]);
}

export function testKeyRotation(): void {
  assert.equal(canRotateApiKey(ApiKeyStatuses.active), true);
  assert.equal(canRotateApiKey(ApiKeyStatuses.revoked), false);
  assert.equal(canRotateApiKey(ApiKeyStatuses.rotated), false);

  const original = generateApiKeyMaterial();
  const rotated = generateApiKeyMaterial();
  assert.notEqual(original.plaintext, rotated.plaintext);
  assert.notEqual(original.keyHash, rotated.keyHash);
}

export function testKeyRevocation(): void {
  assert.equal(canRevokeApiKey(ApiKeyStatuses.active), true);
  assert.equal(canRevokeApiKey(ApiKeyStatuses.expired), true);
  assert.equal(canRevokeApiKey(ApiKeyStatuses.rotated), false);

  assert.equal(
    resolveApiKeyStatus({
      status: ApiKeyStatuses.active,
      expiresAt: new Date("2020-01-01T00:00:00.000Z"),
      now: new Date("2026-08-03T00:00:00.000Z"),
    }),
    ApiKeyStatuses.expired,
  );
  assert.equal(isApiKeyExpired(null), false);
  assert.equal(
    resolveApiKeyStatus({ status: ApiKeyStatuses.revoked, expiresAt: null }),
    ApiKeyStatuses.revoked,
  );
}

export function testWebhookRegistration(): void {
  const secret = generateWebhookSecret();
  assert.ok(secret.plaintext.startsWith("whsec_"));
  assert.equal(secret.secretPrefix, secret.plaintext.slice(0, 12));
  assert.notEqual(secret.secretHash, secret.plaintext);

  assert.deepEqual(normalizeWebhookEvents([" document.created ", "document.created"]), [
    "document.created",
  ]);
  assert.deepEqual(normalizeWebhookEvents([]), ["*"]);

  const policy = defaultRetryPolicy({ maxAttempts: 3, initialDelayMs: 1000 });
  assert.equal(policy.maxAttempts, 3);
  const next = computeNextRetryAt(policy, 1, new Date("2026-08-03T00:00:00.000Z"));
  assert.ok(next);
  assert.equal(
    resolveDeliveryStatusAfterAttempt({ success: false, attemptCount: 3, policy }),
    WebhookDeliveryStatuses.failed,
  );
  assert.equal(
    resolveDeliveryStatusAfterAttempt({ success: true, attemptCount: 1, policy }),
    WebhookDeliveryStatuses.success,
  );
}

export function testServiceAccounts(): void {
  const statuses = Object.values(ServiceAccountStatuses);
  assert.ok(statuses.includes("active"));
  assert.ok(statuses.includes("suspended"));
  assert.ok(statuses.includes("rotated"));

  const secret = `sa_sec_test`;
  const hash = hashDeveloperSecret(secret);
  assert.ok(secretsEqual(secret, hash));
  assert.equal(
    extractApiKeyFromAuthorization("Bearer abc123"),
    "abc123",
  );
  assert.equal(extractApiKeyFromAuthorization("ApiKey xyz"), "xyz");
  assert.equal(extractApiKeyFromAuthorization(undefined), null);
}

export function testRateLimits(): void {
  const defaults = defaultApiKeyRateLimit();
  assert.equal(defaults.maxRequests, DeveloperRateLimits.defaultApiKey.maxRequests);
  assert.equal(defaults.windowMs, DeveloperRateLimits.defaultApiKey.windowMs);

  const custom = defaultApiKeyRateLimit({ maxRequests: 50, windowMs: 10_000 });
  assert.equal(custom.maxRequests, 50);
  assert.equal(buildRateLimitBucketKey("api-key", "abc"), "developer:api-key:abc");
  assert.equal(
    buildRateLimitBucketKey("keys:create", "org-1"),
    "developer:keys:create:org-1",
  );
}
