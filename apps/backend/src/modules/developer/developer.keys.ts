import { randomBytes } from "node:crypto";
import {
  ApiKeyScopes,
  ApiKeyStatuses,
  DeveloperIdPrefixes,
  DeveloperRateLimits,
} from "@trustchain/config";
import { generateOpaqueToken } from "../../lib/crypto.js";
import { hashDeveloperSecret } from "./developer.auth.js";

export type GeneratedApiKey = {
  plaintext: string;
  keyHash: string;
  keyPrefix: string;
  publicCode: string;
};

export type ApiKeyRateLimitConfig = {
  maxRequests: number;
  windowMs: number;
};

export function generatePublicCode(prefix: string): string {
  const suffix = randomBytes(4).toString("hex").toUpperCase();
  return `${prefix}-${suffix}`;
}

export function normalizeScopes(scopes: string[] | undefined | null): string[] {
  const allowed = new Set(Object.values(ApiKeyScopes));
  const unique = new Set<string>();
  for (const scope of scopes ?? [ApiKeyScopes.read]) {
    if (allowed.has(scope as (typeof ApiKeyScopes)[keyof typeof ApiKeyScopes])) {
      unique.add(scope);
    }
  }
  if (unique.size === 0) unique.add(ApiKeyScopes.read);
  return [...unique].sort();
}

export function generateApiKeyMaterial(options?: {
  environment?: "live" | "test";
}): GeneratedApiKey {
  const envPrefix =
    options?.environment === "test"
      ? DeveloperIdPrefixes.apiKeyTest
      : DeveloperIdPrefixes.apiKeyLive;
  const secret = generateOpaqueToken(24);
  const plaintext = `${envPrefix}_${secret}`;
  const keyPrefix = plaintext.slice(0, Math.min(16, plaintext.length));
  return {
    plaintext,
    keyHash: hashDeveloperSecret(plaintext),
    keyPrefix,
    publicCode: generatePublicCode("KEY"),
  };
}

export function isApiKeyExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() <= now.getTime();
}

export function resolveApiKeyStatus(input: {
  status: string;
  expiresAt?: Date | null;
  now?: Date;
}): string {
  if (input.status === ApiKeyStatuses.revoked || input.status === ApiKeyStatuses.rotated) {
    return input.status;
  }
  if (isApiKeyExpired(input.expiresAt, input.now)) {
    return ApiKeyStatuses.expired;
  }
  return input.status;
}

export function defaultApiKeyRateLimit(
  overrides?: Partial<ApiKeyRateLimitConfig> | null,
): ApiKeyRateLimitConfig {
  return {
    maxRequests: overrides?.maxRequests ?? DeveloperRateLimits.defaultApiKey.maxRequests,
    windowMs: overrides?.windowMs ?? DeveloperRateLimits.defaultApiKey.windowMs,
  };
}

export function parseRateLimitConfig(value: unknown): ApiKeyRateLimitConfig {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const maxRequests =
    typeof raw.maxRequests === "number" && Number.isFinite(raw.maxRequests)
      ? Math.max(1, Math.floor(raw.maxRequests))
      : DeveloperRateLimits.defaultApiKey.maxRequests;
  const windowMs =
    typeof raw.windowMs === "number" && Number.isFinite(raw.windowMs)
      ? Math.max(1_000, Math.floor(raw.windowMs))
      : DeveloperRateLimits.defaultApiKey.windowMs;
  return { maxRequests, windowMs };
}

export function canRevokeApiKey(status: string): boolean {
  return status === ApiKeyStatuses.active || status === ApiKeyStatuses.expired;
}

export function canRotateApiKey(status: string): boolean {
  return status === ApiKeyStatuses.active;
}
