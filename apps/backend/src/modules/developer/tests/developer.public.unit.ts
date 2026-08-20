import assert from "node:assert/strict";
import {
  ApiKeyScopes,
  DeveloperIdPrefixes,
  DeveloperRateLimits,
  PublicApiScopeRequirements,
} from "@trustchain/config";
import {
  extractApiKeyFromAuthorization,
  hashDeveloperSecret,
  secretsEqual,
} from "../developer.auth.js";
import {
  assertIdempotencyRequestMatch,
  hashRequestPayload,
  normalizeIdempotencyKey,
} from "../developer.idempotency.js";
import { verifyBearerLooksLikeApiKey } from "../developer.middleware.js";
import { buildRateLimitBucketKey } from "../developer.ratelimit.js";
import { defaultApiKeyRateLimit } from "../developer.keys.js";
import {
  assertCapability,
  assertHasScope,
  hasAnyScope,
  hasScope,
  requiredScopeForMethod,
  scopesForCapability,
} from "../developer.scopes.js";
import { AppError } from "../../../lib/errors.js";

export function testPublicApiAuthentication(): void {
  assert.equal(
    extractApiKeyFromAuthorization("Bearer tc_live_abc"),
    "tc_live_abc",
  );
  assert.equal(extractApiKeyFromAuthorization("ApiKey tc_test_xyz"), "tc_test_xyz");
  assert.equal(extractApiKeyFromAuthorization(undefined), null);
  assert.equal(extractApiKeyFromAuthorization("Basic x"), null);

  assert.equal(verifyBearerLooksLikeApiKey("tc_live_secret"), true);
  assert.equal(verifyBearerLooksLikeApiKey("tc_test_secret"), true);
  assert.equal(verifyBearerLooksLikeApiKey("sa_sec_nope"), false);

  const plaintext = `${DeveloperIdPrefixes.apiKeyLive}_unit`;
  const hash = hashDeveloperSecret(plaintext);
  assert.equal(secretsEqual(plaintext, hash), true);
  assert.equal(secretsEqual("wrong", hash), false);
}

export function testPublicApiAuthorizationScopes(): void {
  assert.equal(hasScope(["read"], ApiKeyScopes.read), true);
  assert.equal(hasScope(["read"], ApiKeyScopes.write), false);
  assert.equal(hasAnyScope(["read"], PublicApiScopeRequirements["usage.read"]), true);
  assert.equal(hasAnyScope(["webhooks"], PublicApiScopeRequirements["usage.read"]), false);

  assert.equal(requiredScopeForMethod("GET"), ApiKeyScopes.read);
  assert.equal(requiredScopeForMethod("POST"), ApiKeyScopes.write);

  assert.deepEqual(scopesForCapability("documents.write"), [ApiKeyScopes.write]);

  assert.throws(
    () => assertHasScope(["read"], ApiKeyScopes.write),
    (err: unknown) => err instanceof AppError && err.code === "INSUFFICIENT_SCOPE",
  );

  assert.throws(
    () => assertCapability(["read"], "certificates.write"),
    (err: unknown) => err instanceof AppError && err.code === "INSUFFICIENT_SCOPE",
  );

  assertCapability(["write"], "certificates.write");
  assertCapability(["read", "keys"], "usage.read");
}

export function testPublicApiIdempotency(): void {
  assert.equal(normalizeIdempotencyKey("  abc  "), "abc");
  assert.equal(normalizeIdempotencyKey(""), null);
  assert.equal(normalizeIdempotencyKey(undefined), null);

  const hashA = hashRequestPayload({
    method: "POST",
    path: "/documents",
    body: { title: "A" },
  });
  const hashB = hashRequestPayload({
    method: "POST",
    path: "/documents",
    body: { title: "A" },
  });
  const hashC = hashRequestPayload({
    method: "POST",
    path: "/documents",
    body: { title: "B" },
  });
  assert.equal(hashA, hashB);
  assert.notEqual(hashA, hashC);
  assert.equal(hashA.length, 64);

  assert.doesNotThrow(() => assertIdempotencyRequestMatch(hashA, hashB));
  assert.throws(
    () => assertIdempotencyRequestMatch(hashA, hashC),
    (err: unknown) => err instanceof AppError && err.code === "IDEMPOTENCY_KEY_REUSE",
  );
}

export function testPublicApiRateLimitingHelpers(): void {
  const defaults = defaultApiKeyRateLimit();
  assert.equal(defaults.maxRequests, DeveloperRateLimits.defaultApiKey.maxRequests);
  assert.equal(defaults.windowMs, DeveloperRateLimits.defaultApiKey.windowMs);

  const custom = defaultApiKeyRateLimit({ maxRequests: 10, windowMs: 5_000 });
  assert.equal(custom.maxRequests, 10);
  assert.equal(
    buildRateLimitBucketKey("api-key", "key-1"),
    "developer:api-key:key-1",
  );
}
