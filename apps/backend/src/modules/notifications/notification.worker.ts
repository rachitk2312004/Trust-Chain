import {
  NotificationDeliveryDefaults,
  NotificationDigestModes,
  NotificationOutboxStatuses,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import * as repo from "./notification.repository.js";
import { deliverOutboxItem, deliverDigestEmail } from "./notification.delivery.js";
import {
  buildDigestItemsFromPayloads,
  groupDigestItemsByUser,
  readDeliveryModeFromPayload,
} from "./notification.digest.js";
import { decideRetry } from "./notification.retry.js";
import { notificationMetrics } from "./notification.metrics.js";
import { publishNotificationDelivered } from "./notification.stream.js";

export type ProcessBatchResult = {
  claimed: number;
  delivered: number;
  retried: number;
  deadLettered: number;
  skipped: number;
};

async function restorePending(id: string, scheduledAt: Date): Promise<void> {
  await prisma.notificationOutbox.updateMany({
    where: { id, status: NotificationOutboxStatuses.processing },
    data: {
      status: NotificationOutboxStatuses.pending,
      scheduledAt,
      attempts: { decrement: 1 },
    },
  });
}

async function claimImmediateDue(limit: number, now: Date) {
  const candidates = await repo.claimDueOutbox(limit * 3, now);
  const immediate = [];

  for (const row of candidates) {
    const mode = readDeliveryModeFromPayload(row.payloadJson);
    if (mode === NotificationDigestModes.daily || mode === NotificationDigestModes.weekly) {
      await restorePending(row.id, now);
      continue;
    }
    if (immediate.length < limit) {
      immediate.push(row);
    } else {
      await restorePending(row.id, now);
    }
  }

  return immediate;
}

/**
 * Process due immediate outbox entries (pending → processing → sent → delivered).
 * Digest-scheduled rows are restored to pending for the digest pass.
 */
export async function processImmediateOutboxBatch(
  limit = NotificationDeliveryDefaults.batchSize,
  now = new Date(),
): Promise<ProcessBatchResult> {
  const claimed = await claimImmediateDue(limit, now);
  const result: ProcessBatchResult = {
    claimed: claimed.length,
    delivered: 0,
    retried: 0,
    deadLettered: 0,
    skipped: 0,
  };

  for (const row of claimed) {
    const delivery = await deliverOutboxItem({
      id: row.id,
      userId: row.userId,
      channel: row.channel,
      eventType: row.eventType,
      payloadJson: row.payloadJson,
      notificationId: row.notificationId,
    });

    if (delivery.ok) {
      await repo.markOutboxSent(row.id, row.notificationId);
      notificationMetrics.recordSent();
      await repo.markOutboxDelivered(row.id, row.notificationId);
      const latencyMs = Math.max(0, now.getTime() - row.createdAt.getTime());
      notificationMetrics.recordDelivered(1, latencyMs);
      publishNotificationDelivered(row.userId, {
        notificationId: row.notificationId,
        outboxId: row.id,
        channel: row.channel,
      });
      result.delivered += 1;
      continue;
    }

    notificationMetrics.recordFailed();
    await repo.markOutboxFailed(row.id, delivery.error);

    const decision = decideRetry({
      attempts: row.attempts,
      error: delivery.error,
      now,
    });

    if (decision.action === "dead_letter" || delivery.permanent) {
      await repo.markOutboxDeadLetter(row.id, {
        lastError: delivery.permanent
          ? `permanent_failure: ${delivery.error}`
          : decision.action === "dead_letter"
            ? decision.reason
            : delivery.error,
        notificationId: row.notificationId,
      });
      notificationMetrics.recordDeadLetter();
      result.deadLettered += 1;
      continue;
    }

    await repo.markOutboxRetry(row.id, {
      scheduledAt: decision.scheduledAt,
      lastError: delivery.error,
      notificationId: row.notificationId,
    });
    notificationMetrics.recordRetry();
    result.retried += 1;
  }

  return result;
}

/** @deprecated alias — prefer processImmediateOutboxBatch */
export const processOutboxBatch = processImmediateOutboxBatch;

export async function processDigestBatch(
  mode: "daily" | "weekly",
  now = new Date(),
  limit = 200,
): Promise<{ users: number; items: number; delivered: number; failed: number }> {
  const rows = await repo.listDueDigestOutbox(mode, now, limit);
  if (rows.length === 0) {
    return { users: 0, items: 0, delivered: 0, failed: 0 };
  }

  const claimed = [];
  for (const row of rows) {
    const updated = await prisma.notificationOutbox.updateMany({
      where: {
        id: row.id,
        status: { in: [NotificationOutboxStatuses.pending, NotificationOutboxStatuses.retry] },
      },
      data: {
        status: NotificationOutboxStatuses.processing,
        scheduledAt: now,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      const fresh = await prisma.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
      claimed.push(fresh);
    }
  }

  const items = buildDigestItemsFromPayloads(claimed);
  const byUser = groupDigestItemsByUser(items);
  let delivered = 0;
  let failed = 0;

  for (const [userId, userItems] of byUser) {
    const result = await deliverDigestEmail({
      userId,
      mode,
      items: userItems.map((i) => ({
        title: i.title,
        message: i.message,
        eventType: i.eventType,
        createdAt: i.createdAt.toISOString(),
      })),
    });

    if (result.ok) {
      notificationMetrics.recordDigest(userItems.length);
    }

    for (const item of userItems) {
      const claimedRow = claimed.find((c) => c.id === item.id);
      if (result.ok) {
        await repo.markOutboxSent(item.id, item.notificationId);
        await repo.markOutboxDelivered(item.id, item.notificationId);
        notificationMetrics.recordSent();
        const latencyMs = Math.max(0, now.getTime() - item.createdAt.getTime());
        notificationMetrics.recordDelivered(1, latencyMs);
        publishNotificationDelivered(userId, {
          notificationId: item.notificationId,
          outboxId: item.id,
          channel: "email",
        });
        delivered += 1;
      } else {
        notificationMetrics.recordFailed();
        await repo.markOutboxFailed(item.id, result.error);
        const decision = decideRetry({
          attempts: claimedRow?.attempts ?? 1,
          error: result.error,
          now,
        });
        if (decision.action === "dead_letter" || result.permanent) {
          await repo.markOutboxDeadLetter(item.id, {
            lastError: result.permanent
              ? `permanent_failure: ${result.error}`
              : decision.action === "dead_letter"
                ? decision.reason
                : result.error,
            notificationId: item.notificationId,
          });
          notificationMetrics.recordDeadLetter();
        } else {
          await repo.markOutboxRetry(item.id, {
            scheduledAt: decision.scheduledAt,
            lastError: result.error,
            notificationId: item.notificationId,
          });
          notificationMetrics.recordRetry();
        }
        failed += 1;
      }
    }
  }

  return { users: byUser.size, items: items.length, delivered, failed };
}

export async function cleanupStaleProcessing(now = new Date()): Promise<number> {
  const olderThan = new Date(now.getTime() - NotificationDeliveryDefaults.staleProcessingMs);
  return repo.reclaimStaleProcessing(olderThan);
}
