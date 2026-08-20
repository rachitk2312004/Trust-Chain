import assert from "node:assert/strict";
import {
  buildIdempotencyKey,
  buildNotificationPayload,
  resolveChannelPreferences,
} from "../notification.payload.js";

type FakeNotification = {
  id: string;
  userId: string;
  eventType: string;
  title: string;
  body: string;
  payload: { idempotencyKey: string };
};

type FakeOutbox = {
  id: string;
  userId: string;
  eventType: string;
  notificationId: string | null;
  payload: { idempotencyKey: string };
};

type FakeStore = {
  notifications: FakeNotification[];
  outbox: FakeOutbox[];
  prefs: Array<{
    eventType: string;
    organizationId: string | null;
    inAppEnabled: boolean;
    emailEnabled: boolean;
  }>;
  failOn?: "notification" | "outbox";
};

function cloneStore(store: FakeStore): FakeStore {
  return {
    notifications: store.notifications.map((n) => ({ ...n, payload: { ...n.payload } })),
    outbox: store.outbox.map((o) => ({ ...o, payload: { ...o.payload } })),
    prefs: store.prefs.map((p) => ({ ...p })),
    failOn: store.failOn,
  };
}

/**
 * In-memory stand-in for publishNotification transactional semantics.
 * Used to verify duplicate protection, outbox creation, preference filtering, and rollback.
 */
export async function fakePublishNotification(
  store: FakeStore,
  input: {
    userId: string;
    organizationId?: string | null;
    eventType: string;
    title: string;
    body: string;
    entityId: string;
    entityType: string;
    actorId: string;
  },
) {
  const payload = buildNotificationPayload({
    actorId: input.actorId,
    organizationId: input.organizationId,
    entityId: input.entityId,
    entityType: input.entityType,
    eventType: input.eventType,
    title: input.title,
    message: input.body,
    userId: input.userId,
  });

  const snapshot = cloneStore(store);
  try {
    const existing = store.notifications.find(
      (n) =>
        n.userId === input.userId &&
        n.eventType === input.eventType &&
        n.payload.idempotencyKey === payload.idempotencyKey,
    );
    if (existing) {
      return { notification: existing, outboxCreated: false, duplicate: true };
    }
    const existingOutbox = store.outbox.find(
      (o) =>
        o.userId === input.userId &&
        o.eventType === input.eventType &&
        o.payload.idempotencyKey === payload.idempotencyKey,
    );
    if (existingOutbox) {
      return { notification: null, outboxCreated: false, duplicate: true };
    }

    const channels = resolveChannelPreferences(
      store.prefs,
      input.eventType,
      input.organizationId,
    );
    if (!channels.inAppEnabled && !channels.emailEnabled) {
      return { notification: null, outboxCreated: false, duplicate: false, skipped: true };
    }

    let notification: FakeNotification | null = null;
    if (channels.inAppEnabled) {
      if (store.failOn === "notification") throw new Error("forced notification failure");
      notification = {
        id: `n-${store.notifications.length + 1}`,
        userId: input.userId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        payload: { idempotencyKey: payload.idempotencyKey },
      };
      store.notifications.push(notification);
    }

    let outboxCreated = false;
    if (channels.emailEnabled) {
      if (store.failOn === "outbox") throw new Error("forced outbox failure");
      store.outbox.push({
        id: `o-${store.outbox.length + 1}`,
        userId: input.userId,
        eventType: input.eventType,
        notificationId: notification?.id ?? null,
        payload: { idempotencyKey: payload.idempotencyKey },
      });
      outboxCreated = true;
    }

    return { notification, outboxCreated, duplicate: false, skipped: false };
  } catch (error) {
    store.notifications = snapshot.notifications;
    store.outbox = snapshot.outbox;
    store.prefs = snapshot.prefs;
    throw error;
  }
}

export function testNotificationPayloadShape() {
  const payload = buildNotificationPayload({
    actorId: "actor-1",
    organizationId: "org-1",
    entityId: "entity-1",
    entityType: "document",
    eventType: "document_uploaded",
    title: "Uploaded",
    message: "A document was uploaded",
    metadata: { version: 1 },
    userId: "user-1",
    createdAt: "2026-08-03T00:00:00.000Z",
  });

  assert.equal(payload.actorId, "actor-1");
  assert.equal(payload.organizationId, "org-1");
  assert.equal(payload.entityId, "entity-1");
  assert.equal(payload.entityType, "document");
  assert.equal(payload.eventType, "document_uploaded");
  assert.equal(payload.title, "Uploaded");
  assert.equal(payload.message, "A document was uploaded");
  assert.deepEqual(payload.metadata, { version: 1 });
  assert.equal(payload.createdAt, "2026-08-03T00:00:00.000Z");
  assert.equal(
    payload.idempotencyKey,
    buildIdempotencyKey({
      eventType: "document_uploaded",
      entityType: "document",
      entityId: "entity-1",
      userId: "user-1",
    }),
  );
}

export function testPreferenceFiltering() {
  const prefs = [
    {
      eventType: "qr_created",
      organizationId: null,
      inAppEnabled: false,
      emailEnabled: true,
    },
    {
      eventType: "document_uploaded",
      organizationId: "org-1",
      inAppEnabled: true,
      emailEnabled: false,
    },
  ];

  assert.deepEqual(resolveChannelPreferences(prefs, "qr_created", "org-1"), {
    inAppEnabled: false,
    emailEnabled: true,
  });
  assert.deepEqual(resolveChannelPreferences(prefs, "document_uploaded", "org-1"), {
    inAppEnabled: true,
    emailEnabled: false,
  });
  assert.deepEqual(resolveChannelPreferences(prefs, "share_created", "org-1"), {
    inAppEnabled: true,
    emailEnabled: true,
  });
}

export async function testEventCreationAndOutbox() {
  const store: FakeStore = { notifications: [], outbox: [], prefs: [] };
  const result = await fakePublishNotification(store, {
    userId: "user-1",
    organizationId: "org-1",
    eventType: "invitation_created",
    title: "Invite",
    body: "Someone was invited",
    entityId: "inv-1",
    entityType: "invitation",
    actorId: "admin-1",
  });
  assert.equal(result.duplicate, false);
  assert.ok(result.notification);
  assert.equal(result.outboxCreated, true);
  assert.equal(store.notifications.length, 1);
  assert.equal(store.outbox.length, 1);
  assert.equal(store.outbox[0]?.notificationId, result.notification?.id);
}

export async function testDuplicateProtection() {
  const store: FakeStore = { notifications: [], outbox: [], prefs: [] };
  const input = {
    userId: "user-1",
    organizationId: "org-1",
    eventType: "qr_created",
    title: "QR",
    body: "created",
    entityId: "qr-1",
    entityType: "document_qr",
    actorId: "admin-1",
  };
  const first = await fakePublishNotification(store, input);
  const second = await fakePublishNotification(store, input);
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(store.notifications.length, 1);
  assert.equal(store.outbox.length, 1);
}

export async function testTransactionRollback() {
  const store: FakeStore = {
    notifications: [],
    outbox: [],
    prefs: [],
    failOn: "outbox",
  };
  await assert.rejects(
    () =>
      fakePublishNotification(store, {
        userId: "user-1",
        organizationId: "org-1",
        eventType: "document_archived",
        title: "Archived",
        body: "archived",
        entityId: "doc-1",
        entityType: "document",
        actorId: "admin-1",
      }),
    /forced outbox failure/,
  );
  assert.equal(store.notifications.length, 0);
  assert.equal(store.outbox.length, 0);
}

export async function testPreferenceSkipsChannels() {
  const store: FakeStore = {
    notifications: [],
    outbox: [],
    prefs: [
      {
        eventType: "verification_completed",
        organizationId: null,
        inAppEnabled: false,
        emailEnabled: false,
      },
    ],
  };
  const result = await fakePublishNotification(store, {
    userId: "user-1",
    organizationId: "org-1",
    eventType: "verification_completed",
    title: "Verified",
    body: "done",
    entityId: "ver-1",
    entityType: "verification_request",
    actorId: "user-1",
  });
  assert.equal(result.skipped, true);
  assert.equal(store.notifications.length, 0);
  assert.equal(store.outbox.length, 0);

  store.prefs = [
    {
      eventType: "verification_completed",
      organizationId: null,
      inAppEnabled: false,
      emailEnabled: true,
    },
  ];
  const emailOnly = await fakePublishNotification(store, {
    userId: "user-1",
    organizationId: "org-1",
    eventType: "verification_completed",
    title: "Verified",
    body: "done",
    entityId: "ver-2",
    entityType: "verification_request",
    actorId: "user-1",
  });
  assert.equal(emailOnly.notification, null);
  assert.equal(emailOnly.outboxCreated, true);
  assert.equal(store.notifications.length, 0);
  assert.equal(store.outbox.length, 1);
}
