import { timingSafeEqual } from "node:crypto";
import { RoleKeys } from "@trustchain/config";
import { hashToken } from "../../lib/crypto.js";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";

export async function assertDeveloperAdmin(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization admin role required");
  }
}

export async function assertDeveloperMember(userId: string, organizationId: string) {
  const ok = await userHasRole(
    userId,
    [RoleKeys.superAdmin, RoleKeys.orgAdmin, RoleKeys.employee],
    organizationId,
  );
  if (!ok) {
    throw new AppError(403, "FORBIDDEN", "Organization membership required");
  }
}

export function hashDeveloperSecret(secret: string): string {
  return hashToken(secret);
}

export function secretsEqual(plaintext: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(plaintext), "utf8");
  const expected = Buffer.from(expectedHash, "utf8");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Foundation helper for future public API auth — not wired to public routes in Step 1.
 * Accepts raw API key material and returns whether it matches a stored hash.
 */
export function verifyApiKeyMaterial(plaintextKey: string, keyHash: string): boolean {
  return secretsEqual(plaintextKey, keyHash);
}

export function extractApiKeyFromAuthorization(header: string | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.toLowerCase().startsWith("bearer ")) {
    return trimmed.slice(7).trim() || null;
  }
  if (trimmed.toLowerCase().startsWith("apikey ")) {
    return trimmed.slice(7).trim() || null;
  }
  return null;
}
