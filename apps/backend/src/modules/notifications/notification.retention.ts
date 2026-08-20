import { NotificationOutboxStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";

export type RetentionPolicy = {
  /** Soft-deleted inbox rows older than this are hard-deleted. */
  deletedNotificationDays: number;
  /** Terminal outbox rows older than this are deleted. */
  terminalOutboxDays: number;
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  deletedNotificationDays: Number.parseInt(
    process.env.NOTIFICATION_RETENTION_DAYS ?? "90",
    10,
  ) || 90,
  terminalOutboxDays: Number.parseInt(
    process.env.NOTIFICATION_OUTBOX_RETENTION_DAYS ?? "90",
    10,
  ) || 90,
};

export type RetentionCleanupResult = {
  deletedNotifications: number;
  deletedOutbox: number;
  cutoffNotifications: string;
  cutoffOutbox: string;
  policy: RetentionPolicy;
};

export function retentionCutoff(days: number, now = new Date()): Date {
  const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

/**
 * Purges expired soft-deleted notifications and terminal outbox rows.
 * No schema changes — hard-deletes eligible rows only.
 */
export async function runNotificationRetentionCleanup(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
  now = new Date(),
): Promise<RetentionCleanupResult> {
  const cutoffNotifications = retentionCutoff(policy.deletedNotificationDays, now);
  const cutoffOutbox = retentionCutoff(policy.terminalOutboxDays, now);

  const deletedNotifications = await prisma.notification.deleteMany({
    where: {
      deletedAt: { not: null, lte: cutoffNotifications },
    },
  });

  const deletedOutbox = await prisma.notificationOutbox.deleteMany({
    where: {
      status: {
        in: [
          NotificationOutboxStatuses.delivered,
          NotificationOutboxStatuses.sent,
          NotificationOutboxStatuses.deadLetter,
          NotificationOutboxStatuses.skipped,
        ],
      },
      createdAt: { lte: cutoffOutbox },
    },
  });

  return {
    deletedNotifications: deletedNotifications.count,
    deletedOutbox: deletedOutbox.count,
    cutoffNotifications: cutoffNotifications.toISOString(),
    cutoffOutbox: cutoffOutbox.toISOString(),
    policy,
  };
}

export async function previewRetentionCleanup(
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
  now = new Date(),
): Promise<{ notificationsEligible: number; outboxEligible: number; policy: RetentionPolicy }> {
  const cutoffNotifications = retentionCutoff(policy.deletedNotificationDays, now);
  const cutoffOutbox = retentionCutoff(policy.terminalOutboxDays, now);
  const [notificationsEligible, outboxEligible] = await Promise.all([
    prisma.notification.count({
      where: { deletedAt: { not: null, lte: cutoffNotifications } },
    }),
    prisma.notificationOutbox.count({
      where: {
        status: {
          in: [
            NotificationOutboxStatuses.delivered,
            NotificationOutboxStatuses.sent,
            NotificationOutboxStatuses.deadLetter,
            NotificationOutboxStatuses.skipped,
          ],
        },
        createdAt: { lte: cutoffOutbox },
      },
    }),
  ]);
  return { notificationsEligible, outboxEligible, policy };
}
