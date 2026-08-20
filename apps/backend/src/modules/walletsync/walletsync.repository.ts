import {
  WalletLinkStatuses,
  WalletOwnershipEventTypes,
  WalletSyncDefaults,
  WalletSyncJobStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  buildOwnershipReport,
  buildSyncPlan,
  executeSyncPlan,
  nextSyncAt,
} from "./walletsync.jobs.js";
import {
  assertOwnershipVerified,
  detectLinkConflict,
  generateOwnershipChallenge,
  normalizeWalletAddress,
  resolveLinkConflict,
  verifyOwnershipProof,
} from "./walletsync.verification.js";

function toPublicWallet(row: {
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
  lastSyncedAt: Date | null;
  verifiedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    provider: row.provider,
    address: row.address,
    addressNormalized: row.addressNormalized,
    label: row.label,
    status: row.status,
    isPrimary: row.isPrimary,
    chainHint: row.chainHint,
    lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    revokedAt: row.revokedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function recordEvent(input: {
  organizationId: string;
  walletLinkId?: string | null;
  userId?: string | null;
  eventType: string;
  address?: string | null;
  summary: string;
  meta?: Record<string, unknown>;
}) {
  await prisma.walletOwnershipEvent.create({
    data: {
      organizationId: input.organizationId,
      walletLinkId: input.walletLinkId ?? null,
      userId: input.userId ?? null,
      eventType: input.eventType,
      address: input.address ?? null,
      summary: input.summary,
      metaJson: (input.meta ?? {}) as Prisma.InputJsonValue,
    },
  });
}

export async function listWallets(query: {
  organizationId: string;
  status?: string;
  userId?: string;
  scopeUserId?: string | null;
  adminView: boolean;
}) {
  const userFilter = query.adminView
    ? query.userId
      ? { userId: query.userId }
      : {}
    : { userId: query.scopeUserId ?? undefined };

  const wallets = await prisma.walletLink.findMany({
    where: {
      organizationId: query.organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...userFilter,
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
  });

  const recentJobs = await prisma.walletSyncJob.findMany({
    where: { organizationId: query.organizationId },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  const report = buildOwnershipReport({
    wallets: wallets.map((w) => ({
      status: w.status,
      isPrimary: w.isPrimary,
      provider: w.provider,
    })),
    eventsCount: 0,
  });

  return {
    organizationId: query.organizationId,
    wallets: wallets.map(toPublicWallet),
    report,
    recentSyncJobs: recentJobs.map((j) => ({
      id: j.id,
      status: j.status,
      scheduledFor: j.scheduledFor.toISOString(),
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

export async function linkWallet(input: {
  organizationId: string;
  userId: string;
  provider: string;
  address: string;
  label?: string;
  chainHint?: string;
  setPrimary?: boolean;
}) {
  const normalized = normalizeWalletAddress(input.address, input.provider);

  const existingCount = await prisma.walletLink.count({
    where: {
      organizationId: input.organizationId,
      userId: input.userId,
      status: { not: WalletLinkStatuses.revoked },
    },
  });
  if (existingCount >= WalletSyncDefaults.maxWalletsPerUser) {
    throw new AppError(
      400,
      "WALLET_LIMIT",
      `Maximum of ${WalletSyncDefaults.maxWalletsPerUser} wallets per user`,
    );
  }

  const existing = await prisma.walletLink.findUnique({
    where: {
      organizationId_addressNormalized: {
        organizationId: input.organizationId,
        addressNormalized: normalized,
      },
    },
  });

  const conflict = detectLinkConflict({
    existingOwnerUserId: existing?.userId ?? null,
    requestingUserId: input.userId,
    existingStatus: existing?.status ?? null,
  });
  const resolution = resolveLinkConflict(conflict);

  if (existing && existing.userId === input.userId && existing.status !== WalletLinkStatuses.revoked) {
    // Re-link same wallet: issue challenge path via return pending wallet
    const challenge = await createChallengeForWallet({
      organizationId: input.organizationId,
      userId: input.userId,
      wallet: existing,
    });
    return {
      wallet: toPublicWallet(existing),
      challenge,
      conflict: null,
      reused: true,
    };
  }

  if (!resolution.allow) {
    if (existing) {
      await prisma.walletLink.update({
        where: { id: existing.id },
        data: { status: WalletLinkStatuses.conflict },
      });
      await recordEvent({
        organizationId: input.organizationId,
        walletLinkId: existing.id,
        userId: input.userId,
        eventType: WalletOwnershipEventTypes.conflict_detected,
        address: normalized,
        summary: `Conflict: address already owned by another user`,
        meta: { existingUserId: existing.userId, requestingUserId: input.userId },
      });
    }
    throw new AppError(
      409,
      "WALLET_CONFLICT",
      "Wallet address is already linked to another user in this organization",
    );
  }

  let wallet;
  if (resolution.action === "reassign" && existing) {
    wallet = await prisma.walletLink.update({
      where: { id: existing.id },
      data: {
        userId: input.userId,
        provider: input.provider,
        address: input.address.trim(),
        addressNormalized: normalized,
        label: input.label ?? existing.label,
        chainHint: input.chainHint ?? existing.chainHint,
        status: WalletLinkStatuses.pending,
        verifiedAt: null,
        revokedAt: null,
        isPrimary: false,
      },
    });
    await recordEvent({
      organizationId: input.organizationId,
      walletLinkId: wallet.id,
      userId: input.userId,
      eventType: WalletOwnershipEventTypes.conflict_resolved,
      address: normalized,
      summary: "Revoked wallet reassigned to new owner",
      meta: { previousUserId: existing.userId },
    });
  } else {
    wallet = await prisma.walletLink.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        provider: input.provider,
        address: input.address.trim(),
        addressNormalized: normalized,
        label: input.label ?? null,
        chainHint: input.chainHint ?? null,
        status: WalletLinkStatuses.pending,
        isPrimary: false,
      },
    });
    await recordEvent({
      organizationId: input.organizationId,
      walletLinkId: wallet.id,
      userId: input.userId,
      eventType: WalletOwnershipEventTypes.linked,
      address: normalized,
      summary: `Linked ${input.provider} wallet`,
    });
  }

  if (input.setPrimary) {
    await setPrimaryWallet(wallet.id, input.organizationId, input.userId);
    wallet = (await prisma.walletLink.findUniqueOrThrow({ where: { id: wallet.id } }))!;
  }

  const challenge = await createChallengeForWallet({
    organizationId: input.organizationId,
    userId: input.userId,
    wallet,
  });

  return {
    wallet: toPublicWallet(wallet),
    challenge,
    conflict: conflict.hasConflict
      ? { reason: conflict.reason, resolution: conflict.resolution }
      : null,
    reused: false,
  };
}

async function createChallengeForWallet(input: {
  organizationId: string;
  userId: string;
  wallet: { id: string; addressNormalized: string; provider: string };
}) {
  const built = generateOwnershipChallenge({
    organizationId: input.organizationId,
    userId: input.userId,
    address: input.wallet.addressNormalized,
    provider: input.wallet.provider,
  });
  const row = await prisma.walletChallenge.create({
    data: {
      organizationId: input.organizationId,
      walletLinkId: input.wallet.id,
      userId: input.userId,
      nonce: built.nonce,
      message: built.message,
      expectedProof: built.expectedProof,
      expiresAt: built.expiresAt,
    },
  });
  return {
    id: row.id,
    walletLinkId: row.walletLinkId,
    nonce: row.nonce,
    message: row.message,
    expiresAt: row.expiresAt.toISOString(),
    // Foundation clients sign by hashing the message (sha256 hex).
    proofHint: "sha256(message)",
  };
}

export async function verifyWallet(input: {
  organizationId: string;
  userId: string;
  walletLinkId: string;
  challengeId?: string;
  proof?: string;
  adminOverride?: boolean;
}) {
  const wallet = await prisma.walletLink.findFirst({
    where: {
      id: input.walletLinkId,
      organizationId: input.organizationId,
    },
  });
  if (!wallet) throw new AppError(404, "NOT_FOUND", "Wallet not found");
  if (!input.adminOverride && wallet.userId !== input.userId) {
    throw new AppError(403, "FORBIDDEN", "Cannot verify another user's wallet");
  }
  if (wallet.status === WalletLinkStatuses.revoked) {
    throw new AppError(400, "WALLET_REVOKED", "Wallet is revoked");
  }

  if (!input.proof) {
    const challenge = await createChallengeForWallet({
      organizationId: input.organizationId,
      userId: wallet.userId,
      wallet,
    });
    return { wallet: toPublicWallet(wallet), challenge, verified: false };
  }

  const challenge = input.challengeId
    ? await prisma.walletChallenge.findFirst({
        where: {
          id: input.challengeId,
          walletLinkId: wallet.id,
          organizationId: input.organizationId,
        },
      })
    : await prisma.walletChallenge.findFirst({
        where: {
          walletLinkId: wallet.id,
          organizationId: input.organizationId,
          consumedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

  if (!challenge) throw new AppError(404, "NOT_FOUND", "Challenge not found");

  const check = verifyOwnershipProof({
    message: challenge.message,
    expectedProof: challenge.expectedProof,
    providedProof: input.proof,
    expiresAt: challenge.expiresAt,
    consumedAt: challenge.consumedAt,
  });
  assertOwnershipVerified(check);

  await prisma.walletChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  const updated = await prisma.walletLink.update({
    where: { id: wallet.id },
    data: {
      status: WalletLinkStatuses.verified,
      verifiedAt: new Date(),
    },
  });

  await recordEvent({
    organizationId: input.organizationId,
    walletLinkId: wallet.id,
    userId: input.userId,
    eventType: WalletOwnershipEventTypes.verified,
    address: wallet.addressNormalized,
    summary: "Wallet ownership verified",
    meta: { challengeId: challenge.id },
  });

  return { wallet: toPublicWallet(updated), challenge: null, verified: true };
}

async function setPrimaryWallet(walletId: string, organizationId: string, userId: string) {
  await prisma.$transaction([
    prisma.walletLink.updateMany({
      where: { organizationId, userId, isPrimary: true },
      data: { isPrimary: false },
    }),
    prisma.walletLink.update({
      where: { id: walletId },
      data: { isPrimary: true },
    }),
  ]);
  await recordEvent({
    organizationId,
    walletLinkId: walletId,
    userId,
    eventType: WalletOwnershipEventTypes.primary_set,
    summary: "Primary wallet updated",
  });
}

export async function patchWallet(
  id: string,
  input: {
    actorUserId: string;
    adminOverride?: boolean;
    label?: string | null;
    isPrimary?: boolean;
    status?: string;
  },
) {
  const wallet = await prisma.walletLink.findUnique({ where: { id } });
  if (!wallet) throw new AppError(404, "NOT_FOUND", "Wallet not found");
  if (!input.adminOverride && wallet.userId !== input.actorUserId) {
    throw new AppError(403, "FORBIDDEN", "Cannot modify another user's wallet");
  }

  if (input.isPrimary === true) {
    await setPrimaryWallet(wallet.id, wallet.organizationId, wallet.userId);
  }

  const updated = await prisma.walletLink.update({
    where: { id },
    data: {
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.isPrimary === true ? { isPrimary: true } : {}),
      ...(input.isPrimary === false ? { isPrimary: false } : {}),
      ...(input.status === "revoked"
        ? {
            status: WalletLinkStatuses.revoked,
            revokedAt: new Date(),
            isPrimary: false,
          }
        : {}),
      ...(input.status === "pending" ? { status: WalletLinkStatuses.pending, verifiedAt: null } : {}),
      ...(input.status === "verified" && input.adminOverride
        ? { status: WalletLinkStatuses.verified, verifiedAt: new Date() }
        : {}),
    },
  });

  if (input.status === "revoked") {
    await recordEvent({
      organizationId: wallet.organizationId,
      walletLinkId: wallet.id,
      userId: input.actorUserId,
      eventType: WalletOwnershipEventTypes.revoked,
      address: wallet.addressNormalized,
      summary: "Wallet link revoked",
    });
  }

  return { wallet: toPublicWallet(updated) };
}

export async function listOwnershipHistory(query: {
  organizationId: string;
  walletLinkId?: string;
  userId?: string;
  scopeUserId?: string | null;
  adminView: boolean;
  limit: number;
  offset: number;
}) {
  const where: Prisma.WalletOwnershipEventWhereInput = {
    organizationId: query.organizationId,
    ...(query.walletLinkId ? { walletLinkId: query.walletLinkId } : {}),
    ...(query.adminView
      ? query.userId
        ? { userId: query.userId }
        : {}
      : { userId: query.scopeUserId ?? undefined }),
  };

  const [events, total, wallets] = await Promise.all([
    prisma.walletOwnershipEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.walletOwnershipEvent.count({ where }),
    prisma.walletLink.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.adminView ? {} : { userId: query.scopeUserId ?? undefined }),
      },
    }),
  ]);

  return {
    events: events.map((e) => ({
      id: e.id,
      walletLinkId: e.walletLinkId,
      userId: e.userId,
      eventType: e.eventType,
      address: e.address,
      summary: e.summary,
      meta: e.metaJson,
      createdAt: e.createdAt.toISOString(),
    })),
    report: buildOwnershipReport({
      wallets: wallets.map((w) => ({
        status: w.status,
        isPrimary: w.isPrimary,
        provider: w.provider,
      })),
      eventsCount: total,
    }),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export async function syncWallets(input: {
  organizationId: string;
  triggeredById: string;
  walletLinkId?: string;
  force?: boolean;
}) {
  const wallets = await prisma.walletLink.findMany({
    where: {
      organizationId: input.organizationId,
      ...(input.walletLinkId ? { id: input.walletLinkId } : {}),
      status: { not: WalletLinkStatuses.revoked },
    },
  });

  const plan = buildSyncPlan({
    wallets: wallets.map((w) => ({
      id: w.id,
      address: w.addressNormalized,
      provider: w.provider,
      status: w.status,
      lastSyncedAt: input.force ? null : w.lastSyncedAt,
    })),
  });
  const startedAt = new Date();
  const result = executeSyncPlan(plan, startedAt);

  const job = await prisma.walletSyncJob.create({
    data: {
      organizationId: input.organizationId,
      walletLinkId: input.walletLinkId ?? null,
      status: WalletSyncJobStatuses.completed,
      scheduledFor: startedAt,
      startedAt,
      completedAt: result.completedAt,
      resultJson: {
        synced: result.synced,
        skipped: result.skipped,
        conflicts: result.conflicts,
        items: result.items,
        nextSyncAt: nextSyncAt({ from: result.completedAt }).toISOString(),
      } as unknown as Prisma.InputJsonValue,
      triggeredById: input.triggeredById,
    },
  });

  const syncedIds = result.items
    .filter((i) => i.outcome === "synced")
    .map((i) => i.walletLinkId);
  if (syncedIds.length > 0) {
    await prisma.walletLink.updateMany({
      where: { id: { in: syncedIds } },
      data: { lastSyncedAt: result.completedAt },
    });
    for (const id of syncedIds) {
      const w = wallets.find((x) => x.id === id);
      await recordEvent({
        organizationId: input.organizationId,
        walletLinkId: id,
        userId: input.triggeredById,
        eventType: WalletOwnershipEventTypes.synced,
        address: w?.addressNormalized,
        summary: "Wallet synchronization completed",
        meta: { jobId: job.id },
      });
    }
  }

  return {
    job: {
      id: job.id,
      status: job.status,
      scheduledFor: job.scheduledFor.toISOString(),
      startedAt: startedAt.toISOString(),
      completedAt: result.completedAt.toISOString(),
      result: {
        synced: result.synced,
        skipped: result.skipped,
        conflicts: result.conflicts,
        items: result.items,
        nextSyncAt: nextSyncAt({ from: result.completedAt }).toISOString(),
      },
      createdAt: job.createdAt.toISOString(),
    },
  };
}

export async function getWalletOrganizationId(id: string): Promise<{
  organizationId: string;
  userId: string;
} | null> {
  const row = await prisma.walletLink.findUnique({
    where: { id },
    select: { organizationId: true, userId: true },
  });
  return row;
}
