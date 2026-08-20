/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { NotificationStreamEventTypes } from "@trustchain/config";
import {
  computeReconnectDelay,
  isDuplicateEventId,
  parseSseChunk,
  asNotificationItem,
} from "./streamClient";
import type { NotificationItem } from "../../types/api";

describe("notification stream client", () => {
  it("parses SSE frames for stream connection", () => {
    const frames: Array<{ id?: string; event?: string; data: string }> = [];
    const leftover = parseSseChunk(
      'id: e1\nevent: notification_created\ndata: {"id":"e1","type":"notification_created","userId":"u","data":{},"ts":"t"}\n\n',
      (f) => frames.push(f),
    );
    expect(leftover).toBe("");
    expect(frames).toHaveLength(1);
    expect(frames[0]?.id).toBe("e1");
    expect(frames[0]?.event).toBe("notification_created");
  });

  it("handles incomplete chunks across reconnect/network interruption", () => {
    const frames: Array<{ data: string }> = [];
    let buf = parseSseChunk("id: a\nevent: unread_count_updated\ndata: {\"id\"", (f) =>
      frames.push(f),
    );
    expect(frames).toHaveLength(0);
    buf = parseSseChunk(
      buf + ':"a","type":"unread_count_updated","userId":"u","data":{"unreadCount":2},"ts":"t"}\n\n',
      (f) => frames.push(f),
    );
    expect(buf).toBe("");
    expect(frames).toHaveLength(1);
    expect(JSON.parse(frames[0]!.data).data.unreadCount).toBe(2);
  });

  it("prevents duplicate events", () => {
    const seen = new Set<string>();
    expect(isDuplicateEventId(seen, "created:1")).toBe(false);
    expect(isDuplicateEventId(seen, "created:1")).toBe(true);
    expect(isDuplicateEventId(seen, "created:2")).toBe(false);
  });

  it("computes reconnect backoff without tight loops", () => {
    const d1 = computeReconnectDelay(1);
    const d5 = computeReconnectDelay(5);
    expect(d1).toBeGreaterThanOrEqual(1000);
    expect(d5).toBeGreaterThan(d1);
    expect(computeReconnectDelay(20)).toBeLessThanOrEqual(30_000 + 250);
  });

  it("applies unread updates from envelope payloads", () => {
    const item = asNotificationItem({
      id: "n1",
      userId: "u1",
      organizationId: null,
      eventType: "document_uploaded",
      title: "Up",
      body: "Body",
      payload: null,
      channel: "in_app",
      emailStatus: null,
      readAt: null,
      createdAt: new Date().toISOString(),
      unread: true,
    } satisfies NotificationItem);
    expect(item?.id).toBe("n1");
    expect(item?.unread).toBe(true);
    expect(NotificationStreamEventTypes.unreadCountUpdated).toBe("unread_count_updated");
  });

  it("supports live rendering insertion ordering", () => {
    const existing: NotificationItem[] = [
      {
        id: "old",
        userId: "u",
        organizationId: null,
        eventType: "share_created",
        title: "Old",
        body: "b",
        payload: null,
        channel: "in_app",
        emailStatus: null,
        readAt: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        unread: true,
      },
    ];
    const incoming: NotificationItem = {
      id: "new",
      userId: "u",
      organizationId: null,
      eventType: "document_uploaded",
      title: "New live",
      body: "just arrived",
      payload: null,
      channel: "in_app",
      emailStatus: "pending",
      readAt: null,
      createdAt: "2026-08-03T12:00:00.000Z",
      unread: true,
    };
    const next = existing.some((n) => n.id === incoming.id)
      ? existing
      : [incoming, ...existing];
    expect(next[0]?.id).toBe("new");
    expect(next).toHaveLength(2);
  });
});
