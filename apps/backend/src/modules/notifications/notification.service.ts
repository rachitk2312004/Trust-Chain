import {
  NotificationChannels,
  NotificationDigestModeList,
  NotificationDigestModes,
  NotificationEmailStatuses,
  NotificationOutboxStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  nextDigestWindow,
  resolveDigestMode,
  type DigestMode,
} from "./notification.digest.js";
import {
  NOTIFICATION_EVENT_LABELS,
  SUPPORTED_NOTIFICATION_EVENTS,
  type NotificationEventType,
  isSupportedNotificationEvent,
} from "./notification.events.js";
import { notificationMetrics } from "./notification.metrics.js";
import {
  buildNotificationPayload,
  resolveChannelPreferences,
} from "./notification.payload.js";
import * as repo from "./notification.repository.js";
import {
  publishNotificationCreated,
  publishNotificationDeleted,
  publishNotificationRead,
  publishUnreadCountUpdated,
} from "./notification.stream.js";

export async function listNotifications(
  userId: string,
  query: {
    unreadOnly?: boolean;
    eventType?: string;
    organizationId?: string;
    limit: number;
    offset: number;
  },
) {
  const result = await repo.listNotificationsForUser(userId, query);
  return {
    notifications: result.notifications.map(repo.toPublicNotification),
    total: result.total,
    unreadCount: result.unreadCount,
    limit: result.limit,
    offset: result.offset,
  };
}

export async function getUnreadCount(userId: string, organizationId?: string) {
  const count = await repo.countUnread(userId, organizationId);
  return { unreadCount: count };
}

export async function getNotification(userId: string, id: string) {
  const row = await repo.findNotificationById(userId, id);
  if (!row) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }
  return { notification: repo.toPublicNotification(row) };
}

export async function markAsRead(userId: string, id: string) {
  const row = await repo.markNotificationRead(userId, id);
  if (!row) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }
  const notification = repo.toPublicNotification(row);
  const unreadCount = await repo.countUnread(userId);
  publishNotificationRead(userId, notification as unknown as Record<string, unknown>, unreadCount);
  return { notification };
}

export async function markAllAsRead(userId: string, organizationId?: string) {
  const updated = await repo.markAllNotificationsRead(userId, organizationId);
  const unreadCount = await repo.countUnread(userId);
  publishUnreadCountUpdated(userId, unreadCount);
  return { updated, unreadCount };
}

export async function deleteNotification(userId: string, id: string) {
  const existing = await repo.findNotificationById(userId, id);
  if (!existing) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }
  await repo.softDeleteNotification(userId, id);
  const unreadCount = await repo.countUnread(userId);
  publishNotificationDeleted(userId, id, unreadCount);
  return { ok: true, unreadCount };
}

export async function getPreferences(userId: string) {
  const stored = await repo.listPreferences(userId);
  const byEvent = new Map(stored.map((row) => [`${row.eventType}:${row.organizationId ?? ""}`, row]));

  const preferences = SUPPORTED_NOTIFICATION_EVENTS.map((eventType) => {
    const key = `${eventType}:`;
    const row = byEvent.get(key);
    if (row) return repo.toPublicPreference(row);
    return {
      id: null,
      userId,
      organizationId: null,
      eventType,
      inAppEnabled: true,
      emailEnabled: true,
      updatedAt: null,
      label: NOTIFICATION_EVENT_LABELS[eventType as NotificationEventType],
    };
  }).map((pref) => ({
    ...pref,
    label:
      NOTIFICATION_EVENT_LABELS[pref.eventType as NotificationEventType] ?? pref.eventType,
  }));

  return {
    preferences,
    eventTypes: SUPPORTED_NOTIFICATION_EVENTS,
    emailDigestMode: resolveDigestMode(stored),
    digestModes: NotificationDigestModeList,
  };
}

export async function updatePreferences(
  userId: string,
  preferences: Array<{
    eventType: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    organizationId?: string | null;
  }>,
  emailDigestMode?: DigestMode,
) {
  for (const pref of preferences) {
    if (!isSupportedNotificationEvent(pref.eventType)) {
      throw new AppError(400, "INVALID_PREFERENCES", `Unsupported event type: ${pref.eventType}`);
    }
  }
  const rows = await repo.upsertPreferences(userId, preferences);
  if (emailDigestMode) {
    if (!(NotificationDigestModeList as readonly string[]).includes(emailDigestMode)) {
      throw new AppError(400, "INVALID_PREFERENCES", `Unsupported digest mode: ${emailDigestMode}`);
    }
    await repo.replaceDigestPreference(userId, emailDigestMode);
  }
  const stored = await repo.listPreferences(userId);
  return {
    preferences: rows.map((row) => ({
      ...repo.toPublicPreference(row),
      label: NOTIFICATION_EVENT_LABELS[row.eventType as NotificationEventType] ?? row.eventType,
    })),
    emailDigestMode: resolveDigestMode(stored),
  };
}

export type PublishNotificationInput = {
  userId: string;
  organizationId?: string | null;
  eventType: NotificationEventType;
  title: string;
  body: string;
  /** @deprecated prefer structured fields below */
  payload?: Record<string, unknown>;
  actorId?: string;
  entityId?: string;
  entityType?: string;
  message?: string;
  metadata?: Record<string, unknown>;
  /** When provided, used for duplicate protection. */
  idempotencyKey?: string;
  /** Override digest mode for this emit (defaults to user preference). */
  deliveryMode?: DigestMode;
};

/**
 * Creates in-app + email-outbox rows atomically (when enabled by preferences).
 * Idempotent on (userId, eventType, idempotencyKey).
 */
export async function publishNotification(input: PublishNotificationInput) {
  if (!isSupportedNotificationEvent(input.eventType)) {
    throw new AppError(400, "INVALID_PREFERENCES", `Unsupported event type: ${input.eventType}`);
  }

  const actorId = input.actorId ?? input.userId;
  const entityId =
    input.entityId ??
    (typeof input.payload?.entityId === "string" ? input.payload.entityId : input.userId);
  const entityType =
    input.entityType ??
    (typeof input.payload?.entityType === "string" ? input.payload.entityType : "unknown");
  const message = input.message ?? input.body;

  return prisma.$transaction(async (tx) => {
    const prefs = await repo.listPreferences(input.userId, tx);
    const deliveryMode =
      input.deliveryMode ?? resolveDigestMode(prefs, NotificationDigestModes.immediate);

    const structured = buildNotificationPayload({
      actorId,
      organizationId: input.organizationId,
      entityId,
      entityType,
      eventType: input.eventType,
      title: input.title,
      message,
      metadata: {
        ...(input.payload ?? {}),
        ...(input.metadata ?? {}),
        deliveryMode,
      },
      userId: input.userId,
    });

    if (input.idempotencyKey) {
      structured.idempotencyKey = input.idempotencyKey;
    }

    const payloadJson = {
      ...structured,
      deliveryMode,
    } as unknown as Prisma.InputJsonValue;

    const existing = await repo.findByIdempotencyKey(
      input.userId,
      input.eventType,
      structured.idempotencyKey,
      tx,
    );
    if (existing) {
      return {
        notification: repo.toPublicNotification(existing),
        outboxCreated: false,
        duplicate: true,
      };
    }

    const existingOutbox = await repo.findOutboxByIdempotencyKey(
      input.userId,
      input.eventType,
      structured.idempotencyKey,
      tx,
    );
    if (existingOutbox) {
      return { notification: null, outboxCreated: false, duplicate: true };
    }

    const channels = resolveChannelPreferences(prefs, input.eventType, input.organizationId);

    if (!channels.inAppEnabled && !channels.emailEnabled) {
      return { notification: null, outboxCreated: false, duplicate: false, skipped: true };
    }

    let notification = null;
    if (channels.inAppEnabled) {
      notification = await repo.createNotification(
        {
          userId: input.userId,
          organizationId: input.organizationId,
          eventType: input.eventType,
          title: input.title,
          body: input.body,
          payloadJson,
          channel: NotificationChannels.inApp,
          emailStatus: channels.emailEnabled
            ? NotificationEmailStatuses.pending
            : NotificationEmailStatuses.skipped,
        },
        tx,
      );
      notificationMetrics.recordCreated();
    }

    let outboxCreated = false;
    if (channels.emailEnabled) {
      await repo.createOutboxEntry(
        {
          notificationId: notification?.id ?? null,
          userId: input.userId,
          organizationId: input.organizationId,
          eventType: input.eventType,
          payloadJson,
          status: NotificationOutboxStatuses.pending,
          scheduledAt: nextDigestWindow(deliveryMode),
        },
        tx,
      );
      outboxCreated = true;
      if (!channels.inAppEnabled) {
        notificationMetrics.recordCreated();
      }
    }

    return {
      notification: notification ? repo.toPublicNotification(notification) : null,
      outboxCreated,
      duplicate: false,
      skipped: false,
      deliveryMode,
    };
  }).then(async (result) => {
    if (result.notification && !result.duplicate && !result.skipped) {
      const unreadCount = await repo.countUnread(input.userId);
      publishNotificationCreated(
        input.userId,
        result.notification as unknown as Record<string, unknown>,
        unreadCount,
      );
    }
    return result;
  });
}
