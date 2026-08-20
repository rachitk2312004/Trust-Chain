import { NotificationOutboxStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import { generateNotificationAnalytics } from "./notification.analytics.js";
import { getNotificationObservability } from "./notification.observability.js";
import {
  DEFAULT_RETENTION_POLICY,
  previewRetentionCleanup,
  runNotificationRetentionCleanup,
  type RetentionPolicy,
} from "./notification.retention.js";
import * as repo from "./notification.repository.js";

export type RetryDeadLettersResult = {
  requested: number;
  recovered: number;
  ids: string[];
};

/**
 * Moves dead-letter outbox rows back to pending for another delivery attempt.
 */
export async function retryDeadLetters(input?: {
  ids?: string[];
  limit?: number;
}): Promise<RetryDeadLettersResult> {
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 200);
  const where =
    input?.ids && input.ids.length > 0
      ? {
          id: { in: input.ids },
          status: NotificationOutboxStatuses.deadLetter,
        }
      : {
          status: NotificationOutboxStatuses.deadLetter,
        };

  const rows = await prisma.notificationOutbox.findMany({
    where,
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const ids: string[] = [];
  for (const row of rows) {
    const updated = await prisma.notificationOutbox.updateMany({
      where: { id: row.id, status: NotificationOutboxStatuses.deadLetter },
      data: {
        status: NotificationOutboxStatuses.pending,
        scheduledAt: new Date(),
        lastError: null,
        attempts: 0,
        sentAt: null,
      },
    });
    if (updated.count === 1) ids.push(row.id);
  }

  return { requested: rows.length, recovered: ids.length, ids };
}

export async function inspectNotification(id: string) {
  const row = await prisma.notification.findFirst({ where: { id } });
  if (!row) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }
  return {
    notification: {
      ...repo.toPublicNotification(row),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      payload: row.payloadJson,
    },
  };
}

export async function inspectOutboxEntry(id: string) {
  const row = await prisma.notificationOutbox.findFirst({ where: { id } });
  if (!row) {
    throw new AppError(404, "OUTBOX_NOT_FOUND", "Outbox entry not found");
  }
  return {
    outbox: {
      id: row.id,
      notificationId: row.notificationId,
      userId: row.userId,
      organizationId: row.organizationId,
      channel: row.channel,
      eventType: row.eventType,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      scheduledAt: row.scheduledAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      payload: row.payloadJson,
    },
  };
}

export async function listDeadLetters(limit = 50, offset = 0) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(offset, 0);
  const [rows, total] = await Promise.all([
    prisma.notificationOutbox.findMany({
      where: { status: NotificationOutboxStatuses.deadLetter },
      orderBy: { createdAt: "desc" },
      take,
      skip,
    }),
    prisma.notificationOutbox.count({
      where: { status: NotificationOutboxStatuses.deadLetter },
    }),
  ]);
  return {
    total,
    limit: take,
    offset: skip,
    items: rows.map((row) => ({
      id: row.id,
      notificationId: row.notificationId,
      userId: row.userId,
      eventType: row.eventType,
      channel: row.channel,
      attempts: row.attempts,
      lastError: row.lastError,
      createdAt: row.createdAt.toISOString(),
      scheduledAt: row.scheduledAt.toISOString(),
    })),
  };
}

export async function listOutboxByStatus(status: string, limit = 50, offset = 0) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = Math.max(offset, 0);
  const [rows, total] = await Promise.all([
    prisma.notificationOutbox.findMany({
      where: { status },
      orderBy: { scheduledAt: "asc" },
      take,
      skip,
    }),
    prisma.notificationOutbox.count({ where: { status } }),
  ]);
  return {
    status,
    total,
    limit: take,
    offset: skip,
    items: rows.map((row) => ({
      id: row.id,
      notificationId: row.notificationId,
      userId: row.userId,
      eventType: row.eventType,
      channel: row.channel,
      status: row.status,
      attempts: row.attempts,
      lastError: row.lastError,
      scheduledAt: row.scheduledAt.toISOString(),
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function getAdminOverview() {
  const [observability, analytics, retentionPreview] = await Promise.all([
    getNotificationObservability(),
    generateNotificationAnalytics(),
    previewRetentionCleanup(),
  ]);
  return { observability, analytics, retentionPreview };
}

export async function purgeExpiredRecords(policy?: Partial<RetentionPolicy>) {
  const merged: RetentionPolicy = {
    ...DEFAULT_RETENTION_POLICY,
    ...policy,
  };
  return runNotificationRetentionCleanup(merged);
}

export async function getRetentionPreview(policy?: Partial<RetentionPolicy>) {
  const merged: RetentionPolicy = {
    ...DEFAULT_RETENTION_POLICY,
    ...policy,
  };
  return previewRetentionCleanup(merged);
}
