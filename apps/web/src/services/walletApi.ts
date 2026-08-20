import { apiClient } from "./http";

export type LinkedWallet = {
  id: string;
  organizationId: string;
  userId: string;
  provider: string;
  address: string;
  addressNormalized: string;
  label: string | null;
  status: string;
  isPrimary: boolean;
  chainHint: string | null;
  lastSyncedAt: string | null;
  verifiedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WalletChallenge = {
  id: string;
  walletLinkId: string;
  nonce: string;
  message: string;
  expiresAt: string;
  proofHint: string;
};

export type WalletOwnershipReport = {
  total: number;
  verified: number;
  pending: number;
  conflicted: number;
  primaryCount: number;
  providers: Record<string, number>;
  healthScore: number;
};

export type WalletDashboard = {
  organizationId: string;
  wallets: LinkedWallet[];
  report: WalletOwnershipReport;
  recentSyncJobs: Array<{
    id: string;
    status: string;
    scheduledFor: string;
    completedAt: string | null;
    createdAt: string;
  }>;
};

export type OwnershipEvent = {
  id: string;
  walletLinkId: string | null;
  userId: string | null;
  eventType: string;
  address: string | null;
  summary: string;
  meta: unknown;
  createdAt: string;
};

export const walletApi = {
  list(organizationId: string, params?: { status?: string; userId?: string }) {
    return apiClient.get<WalletDashboard>("/wallets", {
      params: { organizationId, ...params },
    });
  },

  link(body: Record<string, unknown>) {
    return apiClient.post<{
      wallet: LinkedWallet;
      challenge: WalletChallenge;
      conflict: { reason?: string; resolution?: string } | null;
      reused: boolean;
    }>("/wallets/link", body);
  },

  verify(body: {
    organizationId: string;
    walletLinkId: string;
    challengeId?: string;
    proof?: string;
  }) {
    return apiClient.post<{
      wallet: LinkedWallet;
      challenge: WalletChallenge | null;
      verified: boolean;
    }>("/wallets/verify", body);
  },

  patch(id: string, body: Record<string, unknown>) {
    return apiClient.patch<{ wallet: LinkedWallet }>(`/wallets/${id}`, body);
  },

  history(
    organizationId: string,
    params?: { walletLinkId?: string; userId?: string; limit?: number; offset?: number },
  ) {
    return apiClient.get<{
      events: OwnershipEvent[];
      report: WalletOwnershipReport;
      total: number;
    }>("/wallets/history", {
      params: { organizationId, ...params },
    });
  },

  sync(body: { organizationId: string; walletLinkId?: string; force?: boolean }) {
    return apiClient.post<{
      job: {
        id: string;
        status: string;
        result: {
          synced: number;
          skipped: number;
          conflicts: number;
          nextSyncAt: string;
        };
        completedAt: string;
      };
    }>("/wallets/sync", body);
  },
};
