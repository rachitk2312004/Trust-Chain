import { SignatureStatuses } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import type { OrgSignaturePolicy } from "./signatures.policy.js";
import { resolveEffectiveStatus } from "./signatures.verifier.js";

export function isSignatureExpired(expiresAt: Date | null | undefined, now = new Date()): boolean {
  return Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
}

export function assertSignatureNotExpired(
  status: string,
  expiresAt: Date | null | undefined,
  now = new Date(),
): void {
  const effective = resolveEffectiveStatus(status, expiresAt ?? null, now);
  if (effective === SignatureStatuses.expired) {
    throw new AppError(400, "SIGNATURE_EXPIRED", "Signature has expired");
  }
}

export function assertSignatureNotRevoked(status: string): void {
  if (status === SignatureStatuses.revoked) {
    throw new AppError(400, "SIGNATURE_REVOKED", "Signature has been revoked");
  }
}

/**
 * Computes default expiresAt from org policy when the caller omits one.
 */
export function resolveExpiresAt(input: {
  expiresAt?: Date | string | null;
  signedAt?: Date;
  policy: OrgSignaturePolicy;
}): Date | null {
  const signedAt = input.signedAt ?? new Date();

  if (input.expiresAt === null) return null;
  if (typeof input.expiresAt === "string") {
    const parsed = new Date(input.expiresAt);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(400, "INVALID_EXPIRATION", "Invalid expiration date");
    }
    return parsed;
  }
  if (input.expiresAt instanceof Date) {
    if (Number.isNaN(input.expiresAt.getTime())) {
      throw new AppError(400, "INVALID_EXPIRATION", "Invalid expiration date");
    }
    return input.expiresAt;
  }

  if (input.policy.requireExpiration || input.policy.defaultExpirationDays != null) {
    const days = input.policy.defaultExpirationDays ?? 365;
    return new Date(signedAt.getTime() + days * 24 * 60 * 60 * 1000);
  }
  return null;
}

/**
 * Pure helper: if active/pending and past expiresAt, return expired status.
 */
export function applyExpirationStatus(
  status: string,
  expiresAt: Date | null | undefined,
  now = new Date(),
): string {
  return resolveEffectiveStatus(status, expiresAt ?? null, now);
}

export function shouldPersistExpiredStatus(
  status: string,
  expiresAt: Date | null | undefined,
  now = new Date(),
): boolean {
  return (
    (status === SignatureStatuses.active || status === SignatureStatuses.pending) &&
    isSignatureExpired(expiresAt, now)
  );
}

export type ExpirationCheckResult = {
  expired: boolean;
  status: string;
  expiresAt: string | null;
  remainingMs: number | null;
};

export function evaluateExpiration(
  status: string,
  expiresAt: Date | null | undefined,
  now = new Date(),
): ExpirationCheckResult {
  const effective = applyExpirationStatus(status, expiresAt, now);
  const remainingMs =
    expiresAt && !isSignatureExpired(expiresAt, now)
      ? expiresAt.getTime() - now.getTime()
      : expiresAt
        ? 0
        : null;
  return {
    expired: effective === SignatureStatuses.expired,
    status: effective,
    expiresAt: expiresAt?.toISOString() ?? null,
    remainingMs,
  };
}
