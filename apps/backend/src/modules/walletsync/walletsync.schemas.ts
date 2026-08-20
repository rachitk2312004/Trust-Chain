import { z } from "zod";
import {
  WalletLinkStatusList,
  WalletProviderList,
  WalletSyncDefaults,
} from "@trustchain/config";

export const walletsOrgQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(WalletLinkStatusList as [string, ...string[]]).optional(),
  userId: z.string().uuid().optional(),
});

export const linkWalletBodySchema = z.object({
  organizationId: z.string().uuid(),
  provider: z.enum(WalletProviderList as [string, ...string[]]),
  address: z.string().trim().min(20).max(128),
  label: z.string().trim().min(1).max(100).optional(),
  chainHint: z.string().trim().min(1).max(64).optional(),
  setPrimary: z.boolean().optional(),
});

export const verifyWalletBodySchema = z.object({
  organizationId: z.string().uuid(),
  walletLinkId: z.string().uuid(),
  challengeId: z.string().uuid().optional(),
  // When omitted, a new challenge is issued (challenge-only response).
  proof: z.string().trim().min(32).max(256).optional(),
});

export const patchWalletBodySchema = z.object({
  label: z.string().trim().min(1).max(100).optional().nullable(),
  isPrimary: z.boolean().optional(),
  status: z.enum(["revoked", "pending", "verified"] as [string, ...string[]]).optional(),
});

export const walletIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const walletHistoryQuerySchema = z.object({
  organizationId: z.string().uuid(),
  walletLinkId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(WalletSyncDefaults.maxLimit)
    .default(WalletSyncDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const syncWalletsBodySchema = z.object({
  organizationId: z.string().uuid(),
  walletLinkId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});
