import assert from "node:assert/strict";
import { NotificationDeliveryDefaults, NotificationEventTypes } from "@trustchain/config";
import {
  computeBackoffMs,
  decideRetry,
  isPermanentDeliveryFailure,
} from "../notification.retry.js";
import {
  groupDigestItemsByUser,
  nextDigestWindow,
  readDeliveryModeFromPayload,
  resolveDigestMode,
} from "../notification.digest.js";
import {
  renderDigestEmail,
  renderNotificationEmail,
  supportedTemplateEventTypes,
} from "../notification.templates.js";
import { NotificationMetrics } from "../notification.metrics.js";

/* ── Template rendering ─────────────────────────────────────────── */

export function testTemplateRendering(): void {
  const events = supportedTemplateEventTypes();
  assert.ok(events.includes(NotificationEventTypes.invitationCreated));
  assert.ok(events.includes(NotificationEventTypes.verificationCompleted));
  assert.ok(events.includes(NotificationEventTypes.qrCreated));

  const rendered = renderNotificationEmail({
    eventType: NotificationEventTypes.documentUploaded,
    title: "Doc uploaded",
    message: "A new version is ready.",
    recipientName: "Ada",
  });
  assert.match(rendered.subject, /Document uploaded/i);
  assert.match(rendered.text, /Ada/);
  assert.match(rendered.html, /Doc uploaded/);
  assert.match(rendered.html, /TrustChain/);

  const digest = renderDigestEmail({
    mode: "daily",
    items: [
      { title: "A", message: "one", eventType: "document_uploaded" },
      { title: "B", message: "two", eventType: "share_created" },
    ],
    recipientName: "Bob",
  });
  assert.match(digest.subject, /Daily digest \(2\)/);
  assert.match(digest.text, /Bob/);
  assert.match(digest.html, /A/);
}

/* ── Retry / dead-letter ────────────────────────────────────────── */

export function testRetryLogic(): void {
  assert.equal(computeBackoffMs(1), NotificationDeliveryDefaults.baseBackoffMs);
  assert.equal(computeBackoffMs(2), NotificationDeliveryDefaults.baseBackoffMs * 2);
  assert.equal(computeBackoffMs(3), NotificationDeliveryDefaults.baseBackoffMs * 4);
  assert.ok(isPermanentDeliveryFailure("550 mailbox unavailable"));
  assert.ok(isPermanentDeliveryFailure("recipient_not_found_or_missing_email"));
  assert.equal(isPermanentDeliveryFailure("ETIMEDOUT"), false);

  const now = new Date("2026-08-03T12:00:00.000Z");
  const retry = decideRetry({ attempts: 1, error: "SMTP timeout", now });
  assert.equal(retry.action, "retry");
  if (retry.action === "retry") {
    assert.equal(retry.scheduledAt.getTime(), now.getTime() + computeBackoffMs(1));
  }

  const dead = decideRetry({
    attempts: NotificationDeliveryDefaults.maxAttempts,
    error: "SMTP timeout",
    now,
  });
  assert.equal(dead.action, "dead_letter");

  const permanent = decideRetry({ attempts: 1, error: "invalid email address", now });
  assert.equal(permanent.action, "dead_letter");
}

/* ── Digest generation helpers ──────────────────────────────────── */

export function testDigestGeneration(): void {
  assert.equal(resolveDigestMode([]), "immediate");
  assert.equal(
    resolveDigestMode([{ eventType: "_email_digest:daily", organizationId: null }]),
    "daily",
  );
  assert.equal(
    resolveDigestMode([{ eventType: "_email_digest:weekly", organizationId: null }]),
    "weekly",
  );

  assert.equal(readDeliveryModeFromPayload({ deliveryMode: "daily" }), "daily");
  assert.equal(
    readDeliveryModeFromPayload({ metadata: { deliveryMode: "weekly" } }),
    "weekly",
  );

  const now = new Date("2026-08-03T15:00:00.000Z"); // Monday
  const daily = nextDigestWindow("daily", now);
  assert.equal(daily.toISOString(), "2026-08-04T00:00:00.000Z");

  const weekly = nextDigestWindow("weekly", now);
  assert.equal(weekly.toISOString(), "2026-08-10T00:00:00.000Z");

  const grouped = groupDigestItemsByUser([
    {
      id: "1",
      userId: "u1",
      eventType: "document_uploaded",
      title: "t1",
      message: "m1",
      createdAt: now,
      notificationId: null,
    },
    {
      id: "2",
      userId: "u1",
      eventType: "share_created",
      title: "t2",
      message: "m2",
      createdAt: now,
      notificationId: null,
    },
    {
      id: "3",
      userId: "u2",
      eventType: "qr_created",
      title: "t3",
      message: "m3",
      createdAt: now,
      notificationId: null,
    },
  ]);
  assert.equal(grouped.size, 2);
  assert.equal(grouped.get("u1")?.length, 2);
}

/* ── Delivery success + pipeline (in-memory) ────────────────────── */

type FakeOutbox = {
  id: string;
  status: string;
  attempts: number;
  scheduledAt: Date;
  lastError: string | null;
  channel: string;
  deliveryMode: string;
};

/**
 * Simulates worker claim → deliver → sent → delivered (and failure paths).
 */
export function fakeProcessDelivery(
  items: FakeOutbox[],
  deliver: (item: FakeOutbox) => { ok: true } | { ok: false; error: string; permanent?: boolean },
  now = new Date(),
): { delivered: number; retried: number; deadLettered: number } {
  const due = items.filter(
    (i) =>
      (i.status === "pending" || i.status === "retry") &&
      i.scheduledAt <= now &&
      i.deliveryMode === "immediate",
  );

  let delivered = 0;
  let retried = 0;
  let deadLettered = 0;

  for (const item of due) {
    item.status = "processing";
    item.attempts += 1;
    const result = deliver(item);
    if (result.ok) {
      item.status = "sent";
      item.status = "delivered";
      item.lastError = null;
      delivered += 1;
      continue;
    }
    item.status = "failed";
    item.lastError = result.error;
    const decision = decideRetry({
      attempts: item.attempts,
      error: result.error,
      now,
    });
    if (result.permanent || decision.action === "dead_letter") {
      item.status = "dead_letter";
      deadLettered += 1;
    } else if (decision.action === "retry") {
      item.status = "retry";
      item.scheduledAt = decision.scheduledAt;
      retried += 1;
    }
  }

  return { delivered, retried, deadLettered };
}

export function testDeliverySuccess(): void {
  const items: FakeOutbox[] = [
    {
      id: "a",
      status: "pending",
      attempts: 0,
      scheduledAt: new Date(0),
      lastError: null,
      channel: "email",
      deliveryMode: "immediate",
    },
  ];
  const result = fakeProcessDelivery(items, () => ({ ok: true }));
  assert.equal(result.delivered, 1);
  assert.equal(items[0]!.status, "delivered");
  assert.equal(items[0]!.attempts, 1);
}

export function testDeadLetterLogic(): void {
  const items: FakeOutbox[] = [
    {
      id: "b",
      status: "pending",
      attempts: 0,
      scheduledAt: new Date(0),
      lastError: null,
      channel: "email",
      deliveryMode: "immediate",
    },
  ];
  const result = fakeProcessDelivery(items, () => ({
    ok: false,
    error: "recipient_not_found_or_missing_email",
    permanent: true,
  }));
  assert.equal(result.deadLettered, 1);
  assert.equal(items[0]!.status, "dead_letter");

  const retryUntilDead: FakeOutbox[] = [
    {
      id: "c",
      status: "pending",
      attempts: NotificationDeliveryDefaults.maxAttempts - 1,
      scheduledAt: new Date(0),
      lastError: null,
      channel: "email",
      deliveryMode: "immediate",
    },
  ];
  const r2 = fakeProcessDelivery(retryUntilDead, () => ({ ok: false, error: "timeout" }));
  assert.equal(r2.deadLettered, 1);
  assert.equal(retryUntilDead[0]!.status, "dead_letter");
}

export function testRetryThenSucceed(): void {
  const items: FakeOutbox[] = [
    {
      id: "d",
      status: "pending",
      attempts: 0,
      scheduledAt: new Date(0),
      lastError: null,
      channel: "email",
      deliveryMode: "immediate",
    },
  ];
  const now = new Date("2026-08-03T12:00:00.000Z");
  const fail = fakeProcessDelivery(items, () => ({ ok: false, error: "timeout" }), now);
  assert.equal(fail.retried, 1);
  assert.equal(items[0]!.status, "retry");
  assert.ok(items[0]!.scheduledAt > now);

  // Not due yet
  const early = fakeProcessDelivery(items, () => ({ ok: true }), now);
  assert.equal(early.delivered, 0);

  // After backoff
  const later = new Date(items[0]!.scheduledAt.getTime() + 1);
  const ok = fakeProcessDelivery(items, () => ({ ok: true }), later);
  assert.equal(ok.delivered, 1);
  assert.equal(items[0]!.status, "delivered");
}

/* ── Scheduler tick orchestration (pure) ────────────────────────── */

export async function testSchedulerExecution(): Promise<void> {
  const calls: string[] = [];
  async function tick(parts: {
    outbox: () => Promise<void>;
    daily: () => Promise<void>;
    weekly: () => Promise<void>;
    stale: () => Promise<void>;
  }) {
    await parts.outbox();
    calls.push("outbox");
    await parts.daily();
    calls.push("daily");
    await parts.weekly();
    calls.push("weekly");
    await parts.stale();
    calls.push("stale");
  }

  await tick({
    outbox: async () => undefined,
    daily: async () => undefined,
    weekly: async () => undefined,
    stale: async () => undefined,
  });

  assert.deepEqual(calls, ["outbox", "daily", "weekly", "stale"]);
}

export async function testMetrics(): Promise<void> {
  const m = new NotificationMetrics();
  m.recordCreated(2);
  m.recordSent();
  m.recordDelivered(1, 500);
  m.recordFailed();
  m.recordRetry(3);
  m.recordDeadLetter(2);
  m.recordDigest(4);
  m.setQueueDepthFn(async () => 7);
  m.setActiveConnectionsFn(() => 3);
  const snap = await m.snapshot();
  assert.equal(snap.notificationsCreated, 2);
  assert.equal(snap.notificationsSent, 1);
  assert.equal(snap.notificationsDelivered, 1);
  assert.equal(snap.notificationsFailed, 1);
  assert.equal(snap.retryCount, 3);
  assert.equal(snap.deadLetterCount, 2);
  assert.equal(snap.digestVolume, 4);
  assert.equal(snap.averageDeliveryTimeMs, 500);
  assert.equal(snap.queueDepth, 7);
  assert.equal(snap.activeConnections, 3);
}
