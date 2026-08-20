import type { NotificationEventType } from "./notification.events.js";
import { listOrgAdminUserIds, uniqueUserIds } from "./notification.recipients.js";
import { publishNotification } from "./notification.service.js";

export type DomainNotificationEvent = {
  organizationId: string;
  actorId: string;
  eventType: NotificationEventType;
  entityId: string;
  entityType: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  /** Extra recipients beyond org admins (e.g. document creator, share target). */
  recipientUserIds?: Array<string | null | undefined>;
  /** When true, only recipientUserIds are used (no org-admin fanout). */
  recipientsOnly?: boolean;
};

/**
 * Fan-out a domain event to recipients via publishNotification().
 * Failures are swallowed so domain mutations are not rolled back by delivery issues;
 * each publish call remains transactional for inbox+outbox.
 */
export async function emitDomainNotification(event: DomainNotificationEvent): Promise<void> {
  try {
    const admins = event.recipientsOnly
      ? []
      : await listOrgAdminUserIds(event.organizationId);
    const recipients = uniqueUserIds(admins, event.recipientUserIds ?? []);
    if (recipients.length === 0) return;

    await Promise.all(
      recipients.map((userId) =>
        publishNotification({
          userId,
          organizationId: event.organizationId,
          actorId: event.actorId,
          eventType: event.eventType,
          entityId: event.entityId,
          entityType: event.entityType,
          title: event.title,
          body: event.message,
          message: event.message,
          metadata: event.metadata,
        }),
      ),
    );
  } catch (error) {
    console.error("[notifications] emitDomainNotification failed", {
      eventType: event.eventType,
      entityId: event.entityId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
