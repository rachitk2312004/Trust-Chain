import { createHash, randomBytes } from "node:crypto";
import { WalletProviders, WalletSyncDefaults } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";

export type WalletAddressKind = "evm" | "solana";

export function providerAddressKind(provider: string): WalletAddressKind {
  return provider === WalletProviders.phantom ? "solana" : "evm";
}

/** Normalize wallet address for uniqueness (EVM lowercased; Solana as-is). */
export function normalizeWalletAddress(address: string, provider: string): string {
  const trimmed = address.trim();
  if (!trimmed) {
    throw new AppError(400, "VALIDATION_ERROR", "Wallet address is required");
  }
  const kind = providerAddressKind(provider);
  if (kind === "evm") {
    const hex = trimmed.startsWith("0x") || trimmed.startsWith("0X") ? trimmed.slice(2) : trimmed;
    if (!/^[0-9a-fA-F]{40}$/.test(hex)) {
      throw new AppError(400, "VALIDATION_ERROR", "Invalid EVM wallet address");
    }
    return `0x${hex.toLowerCase()}`;
  }
  // Solana base58 (simplified length check for foundation)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
    throw new AppError(400, "VALIDATION_ERROR", "Invalid Solana wallet address");
  }
  return trimmed;
}

export function displayWalletAddress(normalized: string, provider: string): string {
  return provider === WalletProviders.phantom ? normalized : normalized;
}

export type OwnershipChallenge = {
  nonce: string;
  message: string;
  expectedProof: string;
  expiresAt: Date;
};

/** Challenge message + foundation proof (sha256 of message). Not EIP-191/chain crypto. */
export function generateOwnershipChallenge(input: {
  organizationId: string;
  userId: string;
  address: string;
  provider: string;
  now?: Date;
  ttlSeconds?: number;
}): OwnershipChallenge {
  const now = input.now ?? new Date();
  const ttl = input.ttlSeconds ?? WalletSyncDefaults.challengeTtlSeconds;
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(now.getTime() + ttl * 1000);
  const message = [
    "TrustChain wallet ownership verification",
    `org:${input.organizationId}`,
    `user:${input.userId}`,
    `provider:${input.provider}`,
    `address:${input.address}`,
    `nonce:${nonce}`,
    `expires:${expiresAt.toISOString()}`,
  ].join("\n");
  const expectedProof = createHash("sha256").update(message, "utf8").digest("hex");
  return { nonce, message, expectedProof, expiresAt };
}

export function verifyOwnershipProof(input: {
  message: string;
  expectedProof: string;
  providedProof: string;
  expiresAt: Date | string;
  consumedAt?: Date | string | null;
  now?: Date;
}): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  const now = input.now ?? new Date();
  const expires =
    typeof input.expiresAt === "string" ? new Date(input.expiresAt) : input.expiresAt;

  if (input.consumedAt) reasons.push("challenge_already_consumed");
  if (expires.getTime() <= now.getTime()) reasons.push("challenge_expired");

  const provided = input.providedProof.trim().toLowerCase().replace(/^0x/, "");
  const expected = input.expectedProof.trim().toLowerCase().replace(/^0x/, "");
  if (!provided || provided.length < 32) reasons.push("proof_missing");
  if (provided !== expected) {
    // Also accept recomputed hash of message (client may recompute)
    const recomputed = createHash("sha256").update(input.message, "utf8").digest("hex");
    if (provided !== recomputed) reasons.push("proof_mismatch");
  }

  return { valid: reasons.length === 0, reasons };
}

export function assertOwnershipVerified(result: { valid: boolean; reasons: string[] }): void {
  if (!result.valid) {
    throw new AppError(
      400,
      "WALLET_VERIFICATION_FAILED",
      `Wallet verification failed: ${result.reasons.join(", ")}`,
    );
  }
}

export type LinkConflict = {
  hasConflict: boolean;
  existingUserId?: string;
  resolution?: "reject" | "reassign" | "mark_conflict";
  reason?: string;
};

/** Detect address ownership conflict within an organization. */
export function detectLinkConflict(input: {
  existingOwnerUserId: string | null;
  requestingUserId: string;
  existingStatus?: string | null;
}): LinkConflict {
  if (!input.existingOwnerUserId) {
    return { hasConflict: false };
  }
  if (input.existingOwnerUserId === input.requestingUserId) {
    return { hasConflict: false, reason: "same_owner" };
  }
  if (input.existingStatus === "revoked") {
    return {
      hasConflict: true,
      existingUserId: input.existingOwnerUserId,
      resolution: "reassign",
      reason: "revoked_address_reclaim",
    };
  }
  return {
    hasConflict: true,
    existingUserId: input.existingOwnerUserId,
    resolution: "mark_conflict",
    reason: "address_owned_by_another_user",
  };
}

export function resolveLinkConflict(conflict: LinkConflict): {
  allow: boolean;
  status: "pending" | "conflict";
  action: "create" | "reassign" | "reject" | "none";
} {
  if (!conflict.hasConflict) {
    return { allow: true, status: "pending", action: "create" };
  }
  if (conflict.resolution === "reassign") {
    return { allow: true, status: "pending", action: "reassign" };
  }
  if (conflict.resolution === "mark_conflict") {
    return { allow: false, status: "conflict", action: "reject" };
  }
  return { allow: false, status: "conflict", action: "reject" };
}
