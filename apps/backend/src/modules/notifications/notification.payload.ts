import type { NotificationEventType } from "./notification.events.js";

export type NotificationEventPayload = {
  actorId: string;
  organizationId: string | null;
  entityId: string;
  entityType: string;
  eventType: NotificationEventType | string;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  idempotencyKey: string;
};

export function buildIdempotencyKey(input: {
  eventType: string;
  entityType: string;
  entityId: string;
  userId: string;
}): string {
  return `${input.eventType}:${input.entityType}:${input.entityId}:${input.userId}`;
}

export function buildNotificationPayload(input: {
  actorId: string;
  organizationId?: string | null;
  entityId: string;
  entityType: string;
  eventType: NotificationEventType | string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  userId: string;
  createdAt?: string;
}): NotificationEventPayload {
  const createdAt = input.createdAt ?? new Date().toISOString();
  return {
    actorId: input.actorId,
    organizationId: input.organizationId ?? null,
    entityId: input.entityId,
    entityType: input.entityType,
    eventType: input.eventType,
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
    createdAt,
    idempotencyKey: buildIdempotencyKey({
      eventType: input.eventType,
      entityType: input.entityType,
      entityId: input.entityId,
      userId: input.userId,
    }),
  };
}

export function resolveChannelPreferences(
  prefs: Array<{
    eventType: string;
    organizationId: string | null;
    inAppEnabled: boolean;
    emailEnabled: boolean;
  }>,
  eventType: string,
  organizationId?: string | null,
): { inAppEnabled: boolean; emailEnabled: boolean } {
  const orgId = organizationId ?? null;
  const exact = prefs.find((p) => p.eventType === eventType && p.organizationId === orgId);
  if (exact) {
    return { inAppEnabled: exact.inAppEnabled, emailEnabled: exact.emailEnabled };
  }
  const global = prefs.find((p) => p.eventType === eventType && p.organizationId == null);
  if (global) {
    return { inAppEnabled: global.inAppEnabled, emailEnabled: global.emailEnabled };
  }
  return { inAppEnabled: true, emailEnabled: true };
}
