import { WalletSyncDefaults, WalletSyncJobStatuses } from "@trustchain/config";

export type SyncScheduleInput = {
  lastSyncedAt: Date | string | null;
  intervalMinutes?: number;
  now?: Date;
};

export function shouldScheduleSync(input: SyncScheduleInput): boolean {
  const now = input.now ?? new Date();
  const interval =
    (input.intervalMinutes ?? WalletSyncDefaults.syncIntervalMinutes) * 60_000;
  if (!input.lastSyncedAt) return true;
  const last =
    typeof input.lastSyncedAt === "string"
      ? new Date(input.lastSyncedAt)
      : input.lastSyncedAt;
  return now.getTime() - last.getTime() >= interval;
}

export function nextSyncAt(input: {
  from?: Date;
  intervalMinutes?: number;
}): Date {
  const from = input.from ?? new Date();
  const minutes = input.intervalMinutes ?? WalletSyncDefaults.syncIntervalMinutes;
  return new Date(from.getTime() + minutes * 60_000);
}

export type SyncPlanItem = {
  walletLinkId: string;
  address: string;
  provider: string;
  status: string;
  due: boolean;
};

export type SyncExecutionResult = {
  status: string;
  synced: number;
  skipped: number;
  conflicts: number;
  items: Array<{
    walletLinkId: string;
    outcome: "synced" | "skipped" | "conflict";
    detail: string;
  }>;
  completedAt: Date;
};

/** Build and execute a foundation sync plan (metadata refresh, conflict flags). */
export function buildSyncPlan(input: {
  wallets: Array<{
    id: string;
    address: string;
    provider: string;
    status: string;
    lastSyncedAt: Date | string | null;
  }>;
  now?: Date;
  intervalMinutes?: number;
}): SyncPlanItem[] {
  const now = input.now ?? new Date();
  return input.wallets.map((w) => ({
    walletLinkId: w.id,
    address: w.address,
    provider: w.provider,
    status: w.status,
    due: shouldScheduleSync({
      lastSyncedAt: w.lastSyncedAt,
      intervalMinutes: input.intervalMinutes,
      now,
    }),
  }));
}

export function executeSyncPlan(
  plan: SyncPlanItem[],
  now = new Date(),
): SyncExecutionResult {
  const items: SyncExecutionResult["items"] = [];
  let synced = 0;
  let skipped = 0;
  let conflicts = 0;

  for (const item of plan) {
    if (item.status === "conflict") {
      conflicts += 1;
      items.push({
        walletLinkId: item.walletLinkId,
        outcome: "conflict",
        detail: "wallet_in_conflict_state",
      });
      continue;
    }
    if (item.status === "revoked") {
      skipped += 1;
      items.push({
        walletLinkId: item.walletLinkId,
        outcome: "skipped",
        detail: "wallet_revoked",
      });
      continue;
    }
    if (!item.due && item.status === "verified") {
      skipped += 1;
      items.push({
        walletLinkId: item.walletLinkId,
        outcome: "skipped",
        detail: "sync_not_due",
      });
      continue;
    }
    synced += 1;
    items.push({
      walletLinkId: item.walletLinkId,
      outcome: "synced",
      detail: `provider=${item.provider}`,
    });
  }

  return {
    status: WalletSyncJobStatuses.completed,
    synced,
    skipped,
    conflicts,
    items,
    completedAt: now,
  };
}

export function buildOwnershipReport(input: {
  wallets: Array<{ status: string; isPrimary: boolean; provider: string }>;
  eventsCount: number;
}): {
  total: number;
  verified: number;
  pending: number;
  conflicted: number;
  primaryCount: number;
  providers: Record<string, number>;
  healthScore: number;
} {
  const providers: Record<string, number> = {};
  for (const w of input.wallets) {
    providers[w.provider] = (providers[w.provider] ?? 0) + 1;
  }
  const verified = input.wallets.filter((w) => w.status === "verified").length;
  const pending = input.wallets.filter((w) => w.status === "pending").length;
  const conflicted = input.wallets.filter((w) => w.status === "conflict").length;
  const total = input.wallets.length;
  const healthScore =
    total === 0
      ? 0.5
      : Number(
          Math.max(
            0,
            verified / total - conflicted * 0.15 - (pending > 0 ? 0.05 : 0),
          ).toFixed(3),
        );

  return {
    total,
    verified,
    pending,
    conflicted,
    primaryCount: input.wallets.filter((w) => w.isPrimary).length,
    providers,
    healthScore,
  };
}
