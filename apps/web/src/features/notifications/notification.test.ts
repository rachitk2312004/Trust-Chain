/// <reference types="vitest" />
import { describe, expect, it } from "vitest";
import { NotificationEventTypeList } from "@trustchain/config";
import { getNotificationErrorMessage, isNotificationNotFound } from "../../lib/notificationErrors";
import { eventLabel } from "./NotificationFilters";
import type { NotificationItem } from "../../types/api";
import { AxiosError } from "axios";
import type { ApiErrorBody } from "../../types/api";

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

const sample: NotificationItem[] = [
  {
    id: "1",
    userId: "u1",
    organizationId: "o1",
    eventType: "document_uploaded",
    title: "Upload complete",
    body: "Certificate uploaded",
    payload: null,
    channel: "in_app",
    emailStatus: "pending",
    readAt: null,
    createdAt: new Date().toISOString(),
    unread: true,
  },
  {
    id: "2",
    userId: "u1",
    organizationId: "o1",
    eventType: "qr_created",
    title: "QR ready",
    body: "A QR code was generated",
    payload: null,
    channel: "in_app",
    emailStatus: "sent",
    readAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    unread: false,
  },
  {
    id: "3",
    userId: "u1",
    organizationId: "o1",
    eventType: "verification_completed",
    title: "Verified",
    body: "Document verification completed",
    payload: null,
    channel: "in_app",
    emailStatus: "skipped",
    readAt: null,
    createdAt: new Date().toISOString(),
    unread: true,
  },
];

function filterNotifications(
  items: NotificationItem[],
  opts: { eventType?: string; unreadOnly?: boolean; query?: string },
) {
  return items.filter((item) => {
    if (opts.eventType && item.eventType !== opts.eventType) return false;
    if (opts.unreadOnly && !item.unread) return false;
    const q = opts.query?.trim().toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q);
  });
}

function unreadCount(items: NotificationItem[]) {
  return items.filter((i) => i.unread).length;
}

function markAsRead(items: NotificationItem[], id: string) {
  return items.map((item) =>
    item.id === id
      ? { ...item, unread: false, readAt: item.readAt ?? new Date().toISOString() }
      : item,
  );
}

function markAllAsRead(items: NotificationItem[]) {
  return items.map((item) => ({
    ...item,
    unread: false,
    readAt: item.readAt ?? new Date().toISOString(),
  }));
}

describe("notification foundation helpers", () => {
  it("counts unread notifications", () => {
    expect(unreadCount(sample)).toBe(2);
  });

  it("marks one notification as read", () => {
    const next = markAsRead(sample, "1");
    expect(next.find((n) => n.id === "1")?.unread).toBe(false);
    expect(unreadCount(next)).toBe(1);
  });

  it("marks all notifications as read", () => {
    const next = markAllAsRead(sample);
    expect(unreadCount(next)).toBe(0);
    expect(next.every((n) => n.readAt)).toBe(true);
  });

  it("filters by event type, unread, and query", () => {
    expect(filterNotifications(sample, { eventType: "qr_created" })).toHaveLength(1);
    expect(filterNotifications(sample, { unreadOnly: true })).toHaveLength(2);
    expect(filterNotifications(sample, { query: "certificate" })).toHaveLength(1);
    expect(
      filterNotifications(sample, { eventType: "verification_completed", unreadOnly: true }),
    ).toHaveLength(1);
  });

  it("renders human labels for supported events", () => {
    expect(NotificationEventTypeList).toContain("document_uploaded");
    expect(eventLabel("document_uploaded")).toBe("Document uploaded");
    expect(eventLabel("invitation_created")).toBe("Invitation created");
    expect(eventLabel("verification_completed")).toBe("Verification completed");
  });

  it("maps preference-related API errors", () => {
    expect(getNotificationErrorMessage(axiosError(404, "NOTIFICATION_NOT_FOUND", "x"))).toMatch(
      /not found/i,
    );
    expect(isNotificationNotFound(axiosError(404, "NOTIFICATION_NOT_FOUND", "x"))).toBe(true);
    expect(getNotificationErrorMessage(axiosError(400, "INVALID_PREFERENCES", "bad"))).toBe("bad");
    expect(getNotificationErrorMessage(axiosError(401, "UNAUTHORIZED", "nope"))).toMatch(/sign in/i);
    expect(getNotificationErrorMessage(axiosError(403, "FORBIDDEN", "nope"))).toMatch(/access/i);
  });

  it("applies preference draft toggles", () => {
    const prefs = [
      {
        eventType: "document_uploaded",
        inAppEnabled: true,
        emailEnabled: true,
      },
      {
        eventType: "qr_created",
        inAppEnabled: true,
        emailEnabled: false,
      },
    ];
    const toggled = prefs.map((row) =>
      row.eventType === "qr_created" ? { ...row, inAppEnabled: !row.inAppEnabled } : row,
    );
    expect(toggled.find((p) => p.eventType === "qr_created")?.inAppEnabled).toBe(false);
    expect(toggled.find((p) => p.eventType === "document_uploaded")?.emailEnabled).toBe(true);
  });
});
