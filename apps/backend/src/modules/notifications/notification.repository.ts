import { prisma, type Prisma } from "@trustchain/database";

type Db = Prisma.TransactionClient | typeof prisma;

export type NotificationRow = Awaited<ReturnType<typeof findNotificationById>>;

export function toPublicNotification(row: NonNullable<NotificationRow>) {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    eventType: row.eventType,
    title: row.title,
    body: row.body,
    payload: row.payloadJson,
    channel: row.channel,
    emailStatus: row.emailStatus,
    readAt: row.readAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    unread: row.readAt == null,
  };
}

export function toPublicPreference(row: {
  id: string;
  userId: string;
  organizationId: string | null;
  eventType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    organizationId: row.organizationId,
    eventType: row.eventType,
    inAppEnabled: row.inAppEnabled,
    emailEnabled: row.emailEnabled,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function findNotificationById(userId: string, id: string) {
  return prisma.notification.findFirst({
    where: { id, userId, deletedAt: null },
  });
}

export async function findByIdempotencyKey(
  userId: string,
  eventType: string,
  idempotencyKey: string,
  db: Db = prisma,
) {
  return db.notification.findFirst({
    where: {
      userId,
      eventType,
      deletedAt: null,
      payloadJson: {
        path: ["idempotencyKey"],
        equals: idempotencyKey,
      },
    },
  });
}

export async function findOutboxByIdempotencyKey(
  userId: string,
  eventType: string,
  idempotencyKey: string,
  db: Db = prisma,
) {
  return db.notificationOutbox.findFirst({
    where: {
      userId,
      eventType,
      payloadJson: {
        path: ["idempotencyKey"],
        equals: idempotencyKey,
      },
    },
  });
}

export async function listNotificationsForUser(
  userId: string,
  input: {
    unreadOnly?: boolean;
    eventType?: string;
    organizationId?: string;
    limit: number;
    offset: number;
  },
) {
  const where: Prisma.NotificationWhereInput = {
    userId,
    deletedAt: null,
    ...(input.unreadOnly ? { readAt: null } : {}),
    ...(input.eventType ? { eventType: input.eventType } : {}),
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
  };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit,
      skip: input.offset,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, deletedAt: null, readAt: null } }),
  ]);

  return { notifications, total, unreadCount, limit: input.limit, offset: input.offset };
}

export async function countUnread(userId: string, organizationId?: string) {
  return prisma.notification.count({
    where: {
      userId,
      deletedAt: null,
      readAt: null,
      ...(organizationId ? { organizationId } : {}),
    },
  });
}

export async function markNotificationRead(userId: string, id: string) {
  const existing = await findNotificationById(userId, id);
  if (!existing) return null;
  if (existing.readAt) return existing;
  return prisma.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string, organizationId?: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      deletedAt: null,
      readAt: null,
      ...(organizationId ? { organizationId } : {}),
    },
    data: { readAt: new Date() },
  });
  return result.count;
}

export async function softDeleteNotification(userId: string, id: string) {
  const existing = await findNotificationById(userId, id);
  if (!existing) return null;
  return prisma.notification.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function listPreferences(userId: string, db: Db = prisma) {
  return db.notificationPreference.findMany({
    where: { userId },
    orderBy: [{ eventType: "asc" }, { organizationId: "asc" }],
  });
}

export async function upsertPreferences(
  userId: string,
  items: Array<{
    eventType: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    organizationId?: string | null;
  }>,
) {
  const results = [];
  for (const item of items) {
    const organizationId = item.organizationId ?? null;
    const existing = await prisma.notificationPreference.findFirst({
      where: {
        userId,
        eventType: item.eventType,
        organizationId,
      },
    });
    if (existing) {
      results.push(
        await prisma.notificationPreference.update({
          where: { id: existing.id },
          data: {
            inAppEnabled: item.inAppEnabled,
            emailEnabled: item.emailEnabled,
          },
        }),
      );
    } else {
      results.push(
        await prisma.notificationPreference.create({
          data: {
            userId,
            organizationId,
            eventType: item.eventType,
            inAppEnabled: item.inAppEnabled,
            emailEnabled: item.emailEnabled,
          },
        }),
      );
    }
  }
  return results;
}

export async function createNotification(
  input: {
    userId: string;
    organizationId?: string | null;
    eventType: string;
    title: string;
    body: string;
    payloadJson?: Prisma.InputJsonValue;
    channel?: string;
    emailStatus?: string | null;
  },
  db: Db = prisma,
) {
  return db.notification.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      eventType: input.eventType,
      title: input.title,
      body: input.body,
      payloadJson: input.payloadJson ?? undefined,
      channel: input.channel ?? "in_app",
      emailStatus: input.emailStatus ?? null,
    },
  });
}

export async function createOutboxEntry(
  input: {
    notificationId?: string | null;
    userId: string;
    organizationId?: string | null;
    eventType: string;
    payloadJson: Prisma.InputJsonValue;
    status?: string;
    scheduledAt?: Date;
    channel?: string;
  },
  db: Db = prisma,
) {
  return db.notificationOutbox.create({
    data: {
      notificationId: input.notificationId ?? null,
      userId: input.userId,
      organizationId: input.organizationId ?? null,
      channel: input.channel ?? "email",
      eventType: input.eventType,
      payloadJson: input.payloadJson,
      status: input.status ?? "pending",
      scheduledAt: input.scheduledAt ?? new Date(),
    },
  });
}

export async function countOutboxQueueDepth(db: Db = prisma) {
  return db.notificationOutbox.count({
    where: {
      status: {
        in: ["pending", "processing", "retry", "failed"],
      },
    },
  });
}

export async function claimDueOutbox(limit: number, now = new Date(), db: Db = prisma) {
  const due = await db.notificationOutbox.findMany({
    where: {
      status: { in: ["pending", "retry"] },
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: limit,
  });

  const claimed = [];
  for (const row of due) {
    const updated = await db.notificationOutbox.updateMany({
      where: {
        id: row.id,
        status: { in: ["pending", "retry"] },
      },
      data: {
        status: "processing",
        // Re-use scheduledAt as processing lock timestamp (no lockedAt column).
        scheduledAt: now,
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      const fresh = await db.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } });
      claimed.push(fresh);
    }
  }
  return claimed;
}

export async function markOutboxDelivered(
  id: string,
  notificationId: string | null,
  db: Db = prisma,
) {
  const sentAt = new Date();
  await db.notificationOutbox.update({
    where: { id },
    data: {
      status: "delivered",
      sentAt,
      lastError: null,
    },
  });
  if (notificationId) {
    await db.notification.updateMany({
      where: { id: notificationId },
      data: { emailStatus: "delivered" },
    });
  }
}

export async function markOutboxSent(
  id: string,
  notificationId: string | null,
  db: Db = prisma,
) {
  const sentAt = new Date();
  await db.notificationOutbox.update({
    where: { id },
    data: {
      status: "sent",
      sentAt,
      lastError: null,
    },
  });
  if (notificationId) {
    await db.notification.updateMany({
      where: { id: notificationId },
      data: { emailStatus: "sent" },
    });
  }
}

export async function markOutboxRetry(
  id: string,
  input: { scheduledAt: Date; lastError: string; notificationId?: string | null },
  db: Db = prisma,
) {
  await db.notificationOutbox.update({
    where: { id },
    data: {
      status: "retry",
      scheduledAt: input.scheduledAt,
      lastError: input.lastError.slice(0, 2000),
    },
  });
  if (input.notificationId) {
    await db.notification.updateMany({
      where: { id: input.notificationId },
      data: { emailStatus: "failed" },
    });
  }
}

export async function markOutboxDeadLetter(
  id: string,
  input: { lastError: string; notificationId?: string | null },
  db: Db = prisma,
) {
  await db.notificationOutbox.update({
    where: { id },
    data: {
      status: "dead_letter",
      lastError: input.lastError.slice(0, 2000),
    },
  });
  if (input.notificationId) {
    await db.notification.updateMany({
      where: { id: input.notificationId },
      data: { emailStatus: "failed" },
    });
  }
}

export async function markOutboxFailed(
  id: string,
  lastError: string,
  db: Db = prisma,
) {
  await db.notificationOutbox.update({
    where: { id },
    data: {
      status: "failed",
      lastError: lastError.slice(0, 2000),
    },
  });
}

export async function reclaimStaleProcessing(
  olderThan: Date,
  db: Db = prisma,
) {
  const stale = await db.notificationOutbox.findMany({
    where: {
      status: "processing",
      scheduledAt: { lte: olderThan },
    },
    take: 100,
  });

  let reclaimed = 0;
  for (const row of stale) {
    const result = await db.notificationOutbox.updateMany({
      where: { id: row.id, status: "processing" },
      data: {
        status: "retry",
        scheduledAt: new Date(),
        lastError: "stale_processing_reclaimed",
      },
    });
    reclaimed += result.count;
  }
  return reclaimed;
}

/** Digest-mode pending/retry rows whose deliveryMode is daily|weekly and due. */
export async function listDueDigestOutbox(
  mode: "daily" | "weekly",
  now = new Date(),
  limit = 200,
  db: Db = prisma,
) {
  const candidates = await db.notificationOutbox.findMany({
    where: {
      status: { in: ["pending", "retry"] },
      scheduledAt: { lte: now },
      channel: "email",
    },
    orderBy: { scheduledAt: "asc" },
    take: limit * 3,
  });

  return candidates.filter((row) => {
    const payload = row.payloadJson as { deliveryMode?: string; metadata?: { deliveryMode?: string } };
    const dm = payload?.deliveryMode ?? payload?.metadata?.deliveryMode;
    return dm === mode;
  }).slice(0, limit);
}

export async function replaceDigestPreference(
  userId: string,
  mode: string,
  db: Db = prisma,
) {
  await db.notificationPreference.deleteMany({
    where: {
      userId,
      organizationId: null,
      eventType: { startsWith: "_email_digest:" },
    },
  });
  return db.notificationPreference.create({
    data: {
      userId,
      organizationId: null,
      eventType: `_email_digest:${mode}`,
      inAppEnabled: true,
      emailEnabled: true,
    },
  });
}
