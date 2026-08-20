import { randomUUID } from "node:crypto";
import { NotificationStreamEventTypes } from "@trustchain/config";
import {
  notificationConnections,
  type NotificationConnectionManager,
  type SseConnection,
} from "./notification.connection.js";

export type StreamEventName =
  (typeof NotificationStreamEventTypes)[keyof typeof NotificationStreamEventTypes];

export type NotificationStreamEnvelope = {
  id: string;
  type: StreamEventName | string;
  userId: string;
  data: Record<string, unknown>;
  ts: string;
};

export function createStreamEnvelope(input: {
  type: StreamEventName | string;
  userId: string;
  data: Record<string, unknown>;
  id?: string;
}): NotificationStreamEnvelope {
  return {
    id: input.id ?? randomUUID(),
    type: input.type,
    userId: input.userId,
    data: input.data,
    ts: new Date().toISOString(),
  };
}

export function formatSseMessage(envelope: NotificationStreamEnvelope): string {
  return `id: ${envelope.id}\nevent: ${envelope.type}\ndata: ${JSON.stringify(envelope)}\n\n`;
}

function writeToConnection(conn: SseConnection, chunk: string): boolean {
  if (conn.closed) return false;
  try {
    const ok = conn.res.write(chunk);
    return ok !== false;
  } catch {
    return false;
  }
}

/**
 * Publishes a typed SSE event to all active connections for a user.
 * Returns number of successful writes.
 */
export function publishToUser(
  userId: string,
  envelope: NotificationStreamEnvelope,
  manager: NotificationConnectionManager = notificationConnections,
): number {
  const connections = manager.listForUser(userId);
  if (connections.length === 0) return 0;
  const chunk = formatSseMessage(envelope);
  let sent = 0;
  for (const conn of connections) {
    if (writeToConnection(conn, chunk)) {
      manager.touch(conn.id);
      sent += 1;
    } else {
      manager.remove(conn.id);
      try {
        conn.res.end();
      } catch {
        /* ignore */
      }
    }
  }
  return sent;
}

export function publishNotificationCreated(
  userId: string,
  notification: Record<string, unknown>,
  unreadCount: number,
  manager?: NotificationConnectionManager,
): void {
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.notificationCreated,
      userId,
      data: { notification, unreadCount },
      id: `created:${String(notification.id ?? randomUUID())}`,
    }),
    manager,
  );
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.unreadCountUpdated,
      userId,
      data: { unreadCount },
      id: `unread:${userId}:${unreadCount}:${Date.now()}`,
    }),
    manager,
  );
}

export function publishNotificationRead(
  userId: string,
  notification: Record<string, unknown>,
  unreadCount: number,
  manager?: NotificationConnectionManager,
): void {
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.notificationRead,
      userId,
      data: { notification, unreadCount },
      id: `read:${String(notification.id ?? randomUUID())}`,
    }),
    manager,
  );
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.unreadCountUpdated,
      userId,
      data: { unreadCount },
      id: `unread:${userId}:${unreadCount}:${Date.now()}`,
    }),
    manager,
  );
}

export function publishNotificationDeleted(
  userId: string,
  notificationId: string,
  unreadCount: number,
  manager?: NotificationConnectionManager,
): void {
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.notificationDeleted,
      userId,
      data: { notificationId, unreadCount },
      id: `deleted:${notificationId}`,
    }),
    manager,
  );
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.unreadCountUpdated,
      userId,
      data: { unreadCount },
      id: `unread:${userId}:${unreadCount}:${Date.now()}`,
    }),
    manager,
  );
}

export function publishUnreadCountUpdated(
  userId: string,
  unreadCount: number,
  manager?: NotificationConnectionManager,
): void {
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.unreadCountUpdated,
      userId,
      data: { unreadCount },
      id: `unread:${userId}:${unreadCount}:${Date.now()}`,
    }),
    manager,
  );
}

export function publishNotificationDelivered(
  userId: string,
  input: { notificationId: string | null; outboxId: string; channel?: string },
  manager?: NotificationConnectionManager,
): void {
  publishToUser(
    userId,
    createStreamEnvelope({
      type: NotificationStreamEventTypes.notificationDelivered,
      userId,
      data: {
        notificationId: input.notificationId,
        outboxId: input.outboxId,
        channel: input.channel ?? "email",
      },
      id: `delivered:${input.outboxId}`,
    }),
    manager,
  );
}
