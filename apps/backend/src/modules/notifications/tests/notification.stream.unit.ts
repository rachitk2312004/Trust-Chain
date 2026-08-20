import assert from "node:assert/strict";
import type { Response } from "express";
import { NotificationStreamEventTypes } from "@trustchain/config";
import { NotificationConnectionManager } from "../notification.connection.js";
import {
  createStreamEnvelope,
  formatSseMessage,
  publishNotificationCreated,
  publishToUser,
} from "../notification.stream.js";

function fakeRes(chunks: string[]): Response {
  return {
    write(chunk: string) {
      chunks.push(String(chunk));
      return true;
    },
    end() {
      return this;
    },
  } as unknown as Response;
}

export function testStreamConnection(): void {
  const manager = new NotificationConnectionManager({ staleMs: 1_000, now: () => 5_000 });
  const chunks: string[] = [];
  const conn = manager.add({
    userId: "user-1",
    sessionId: "sess-1",
    res: fakeRes(chunks),
  });
  assert.equal(manager.connectionCount("user-1"), 1);
  assert.equal(manager.get(conn.id)?.userId, "user-1");

  const envelope = createStreamEnvelope({
    type: NotificationStreamEventTypes.notificationCreated,
    userId: "user-1",
    data: { hello: true },
    id: "evt-1",
  });
  const sent = publishToUser("user-1", envelope, manager);
  assert.equal(sent, 1);
  assert.ok(chunks[0]?.includes("event: notification_created"));
  assert.ok(chunks[0]?.includes("id: evt-1"));

  manager.remove(conn.id);
  assert.equal(manager.connectionCount("user-1"), 0);
}

export function testStaleConnectionCleanup(): void {
  let now = 0;
  const manager = new NotificationConnectionManager({ staleMs: 100, now: () => now });
  const chunks: string[] = [];
  const conn = manager.add({
    userId: "u",
    sessionId: "s",
    res: fakeRes(chunks),
  });
  now = 200;
  const removed = manager.cleanupStale(now);
  assert.deepEqual(removed, [conn.id]);
  assert.equal(manager.connectionCount(), 0);
}

export function testDuplicateEventIds(): void {
  const a = createStreamEnvelope({
    type: NotificationStreamEventTypes.notificationCreated,
    userId: "u",
    data: { notification: { id: "n1" } },
    id: "created:n1",
  });
  const b = createStreamEnvelope({
    type: NotificationStreamEventTypes.notificationCreated,
    userId: "u",
    data: { notification: { id: "n1" } },
    id: "created:n1",
  });
  assert.equal(a.id, b.id);
  assert.equal(formatSseMessage(a).split("\n")[0], "id: created:n1");
}

export function testUnreadUpdatesViaStream(): void {
  const manager = new NotificationConnectionManager();
  const chunks: string[] = [];
  manager.add({ userId: "u2", sessionId: "s2", res: fakeRes(chunks) });
  publishNotificationCreated(
    "u2",
    { id: "n9", title: "Hello", unread: true },
    3,
    manager,
  );
  assert.ok(chunks.some((c) => c.includes("notification_created")));
  assert.ok(chunks.some((c) => c.includes("unread_count_updated")));
  assert.ok(chunks.some((c) => c.includes('"unreadCount":3')));
}

export function testReconnectSupportEnvelope(): void {
  // Reconnect clients resume via Last-Event-ID conceptually; we ensure ids are stable+present.
  const envelope = createStreamEnvelope({
    type: NotificationStreamEventTypes.connected,
    userId: "u",
    data: { connectionId: "c1" },
    id: "connected:c1",
  });
  const msg = formatSseMessage(envelope);
  assert.match(msg, /^id: connected:c1\n/);
  assert.match(msg, /event: connected\n/);
  assert.match(msg, /data: \{/);
}

export function testMultiTabConnections(): void {
  const manager = new NotificationConnectionManager();
  const a: string[] = [];
  const b: string[] = [];
  manager.add({ userId: "same", sessionId: "s1", res: fakeRes(a) });
  manager.add({ userId: "same", sessionId: "s2", res: fakeRes(b) });
  assert.equal(manager.connectionCount("same"), 2);
  publishToUser(
    "same",
    createStreamEnvelope({
      type: NotificationStreamEventTypes.unreadCountUpdated,
      userId: "same",
      data: { unreadCount: 1 },
      id: "unread:same:1",
    }),
    manager,
  );
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
}
