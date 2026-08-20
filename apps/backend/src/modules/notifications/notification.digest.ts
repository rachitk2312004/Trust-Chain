import {
  NotificationDigestModes,
  NotificationDigestPreferenceEventType,
} from "@trustchain/config";

export type DigestMode =
  (typeof NotificationDigestModes)[keyof typeof NotificationDigestModes];

/** Prefer exact reserved row `_email_digest:<mode>`, else system default. */
export function resolveDigestMode(
  prefs: Array<{ eventType: string; organizationId: string | null }>,
  fallback: DigestMode = NotificationDigestModes.immediate,
): DigestMode {
  const prefix = `${NotificationDigestPreferenceEventType}:`;
  const row = prefs.find(
    (p) => p.organizationId == null && p.eventType.startsWith(prefix),
  );
  if (row) {
    const mode = row.eventType.slice(prefix.length);
    if (
      mode === NotificationDigestModes.immediate ||
      mode === NotificationDigestModes.daily ||
      mode === NotificationDigestModes.weekly
    ) {
      return mode;
    }
  }
  const env = process.env.NOTIFICATION_DEFAULT_DIGEST_MODE;
  if (
    env === NotificationDigestModes.immediate ||
    env === NotificationDigestModes.daily ||
    env === NotificationDigestModes.weekly
  ) {
    return env;
  }
  return fallback;
}

export function digestPreferenceEventType(mode: DigestMode): string {
  return `${NotificationDigestPreferenceEventType}:${mode}`;
}

export function isDigestPreferenceEventType(eventType: string): boolean {
  return eventType.startsWith(`${NotificationDigestPreferenceEventType}:`);
}

/** Next UTC midnight (for daily) or next Monday 00:00 UTC (for weekly). */
export function nextDigestWindow(mode: DigestMode, now = new Date()): Date {
  if (mode === NotificationDigestModes.immediate) {
    return now;
  }

  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  next.setUTCHours(0, 0, 0, 0);

  if (mode === NotificationDigestModes.daily) {
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  // weekly — next Monday 00:00 UTC (if already Monday and past midnight, still next week)
  const day = next.getUTCDay(); // 0 Sun … 6 Sat
  const daysUntilMonday = day === 0 ? 1 : day === 1 ? 7 : 8 - day;
  next.setUTCDate(next.getUTCDate() + daysUntilMonday);
  return next;
}

export function readDeliveryModeFromPayload(
  payload: unknown,
  fallback: DigestMode = NotificationDigestModes.immediate,
): DigestMode {
  if (!payload || typeof payload !== "object") return fallback;
  const meta = (payload as { metadata?: Record<string, unknown>; deliveryMode?: unknown })
    .metadata;
  const direct = (payload as { deliveryMode?: unknown }).deliveryMode;
  const raw = typeof direct === "string" ? direct : meta?.deliveryMode;
  if (
    raw === NotificationDigestModes.immediate ||
    raw === NotificationDigestModes.daily ||
    raw === NotificationDigestModes.weekly
  ) {
    return raw;
  }
  return fallback;
}

export type DigestBucketItem = {
  id: string;
  userId: string;
  eventType: string;
  title: string;
  message: string;
  createdAt: Date;
  notificationId: string | null;
};

/**
 * Groups due digest outbox items by user for a single digest email.
 */
export function groupDigestItemsByUser(
  items: DigestBucketItem[],
): Map<string, DigestBucketItem[]> {
  const map = new Map<string, DigestBucketItem[]>();
  for (const item of items) {
    const list = map.get(item.userId) ?? [];
    list.push(item);
    map.set(item.userId, list);
  }
  return map;
}

export function buildDigestItemsFromPayloads(
  rows: Array<{
    id: string;
    userId: string;
    eventType: string;
    notificationId: string | null;
    createdAt: Date;
    payloadJson: unknown;
  }>,
): DigestBucketItem[] {
  return rows.map((row) => {
    const payload = row.payloadJson as {
      title?: string;
      message?: string;
    } | null;
    return {
      id: row.id,
      userId: row.userId,
      eventType: row.eventType,
      title: typeof payload?.title === "string" ? payload.title : row.eventType,
      message: typeof payload?.message === "string" ? payload.message : "",
      createdAt: row.createdAt,
      notificationId: row.notificationId,
    };
  });
}
