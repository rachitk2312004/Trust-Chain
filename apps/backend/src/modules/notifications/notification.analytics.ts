import { NotificationOutboxStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { readDeliveryModeFromPayload } from "./notification.digest.js";
import { averageLatency } from "./notification.metrics.js";

export type QueueStatistics = {
  pending: number;
  processing: number;
  retry: number;
  failed: number;
  sent: number;
  delivered: number;
  deadLetter: number;
  skipped: number;
  depth: number;
};

export type DeliveryStatistics = {
  totalOutbox: number;
  delivered: number;
  sent: number;
  failed: number;
  deadLetter: number;
  successRate: number | null;
  averageDeliveryTimeMs: number | null;
  sampleSize: number;
};

export type FailureAnalysis = {
  totalFailed: number;
  deadLetters: number;
  topErrors: Array<{ error: string; count: number }>;
  permanentHintCount: number;
};

export type RetryAnalysis = {
  retrying: number;
  averageAttemptsAmongRetries: number | null;
  maxAttemptsAmongRetries: number;
  highAttemptCount: number;
};

export type ChannelUtilization = {
  inAppNotifications: number;
  emailOutbox: number;
  emailPendingLike: number;
  emailDelivered: number;
};

export type DigestStatistics = {
  immediate: number;
  daily: number;
  weekly: number;
  unknown: number;
  pendingDigest: number;
};

export type NotificationAnalyticsSnapshot = {
  generatedAt: string;
  queue: QueueStatistics;
  delivery: DeliveryStatistics;
  failures: FailureAnalysis;
  retries: RetryAnalysis;
  channels: ChannelUtilization;
  digests: DigestStatistics;
  notificationsCreated: number;
  notificationsDeleted: number;
};

function normalizeErrorKey(error: string | null | undefined): string {
  if (!error) return "(none)";
  const trimmed = error.trim().slice(0, 120);
  if (/permanent_failure/i.test(trimmed)) return "permanent_failure";
  if (/max_attempts/i.test(trimmed)) return "max_attempts_reached";
  if (/recipient/i.test(trimmed)) return "recipient_error";
  if (/timeout|ETIMEDOUT|ECONN/i.test(trimmed)) return "network_timeout";
  if (/SMTP|550|553/i.test(trimmed)) return "smtp_error";
  return trimmed;
}

/** Pure helper — average latency from (createdAt, sentAt) pairs. */
export function calculateAverageDeliveryLatency(
  rows: Array<{ createdAt: Date; sentAt: Date | null }>,
): { averageDeliveryTimeMs: number | null; sampleSize: number } {
  const samples: number[] = [];
  for (const row of rows) {
    if (!row.sentAt) continue;
    samples.push(Math.max(0, row.sentAt.getTime() - row.createdAt.getTime()));
  }
  return { averageDeliveryTimeMs: averageLatency(samples), sampleSize: samples.length };
}

export function buildQueueStatistics(counts: Record<string, number>): QueueStatistics {
  const pending = counts[NotificationOutboxStatuses.pending] ?? 0;
  const processing = counts[NotificationOutboxStatuses.processing] ?? 0;
  const retry = counts[NotificationOutboxStatuses.retry] ?? 0;
  const failed = counts[NotificationOutboxStatuses.failed] ?? 0;
  const sent = counts[NotificationOutboxStatuses.sent] ?? 0;
  const delivered = counts[NotificationOutboxStatuses.delivered] ?? 0;
  const deadLetter = counts[NotificationOutboxStatuses.deadLetter] ?? 0;
  const skipped = counts[NotificationOutboxStatuses.skipped] ?? 0;
  return {
    pending,
    processing,
    retry,
    failed,
    sent,
    delivered,
    deadLetter,
    skipped,
    depth: pending + processing + retry + failed,
  };
}

export function buildFailureAnalysis(
  rows: Array<{ lastError: string | null; status: string }>,
): FailureAnalysis {
  const failedRows = rows.filter(
    (r) =>
      r.status === NotificationOutboxStatuses.failed ||
      r.status === NotificationOutboxStatuses.deadLetter,
  );
  const deadLetters = rows.filter((r) => r.status === NotificationOutboxStatuses.deadLetter).length;
  const tallies = new Map<string, number>();
  let permanentHintCount = 0;
  for (const row of failedRows) {
    const key = normalizeErrorKey(row.lastError);
    tallies.set(key, (tallies.get(key) ?? 0) + 1);
    if (/permanent/i.test(row.lastError ?? "")) permanentHintCount += 1;
  }
  const topErrors = [...tallies.entries()]
    .map(([error, count]) => ({ error, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  return {
    totalFailed: failedRows.length,
    deadLetters,
    topErrors,
    permanentHintCount,
  };
}

export function buildRetryAnalysis(
  rows: Array<{ status: string; attempts: number }>,
): RetryAnalysis {
  const retrying = rows.filter((r) => r.status === NotificationOutboxStatuses.retry);
  const attempts = retrying.map((r) => r.attempts);
  const averageAttemptsAmongRetries =
    attempts.length === 0
      ? null
      : Math.round((attempts.reduce((a, b) => a + b, 0) / attempts.length) * 100) / 100;
  return {
    retrying: retrying.length,
    averageAttemptsAmongRetries,
    maxAttemptsAmongRetries: attempts.length ? Math.max(...attempts) : 0,
    highAttemptCount: retrying.filter((r) => r.attempts >= 3).length,
  };
}

export function buildDigestStatistics(
  payloads: Array<{ payloadJson: unknown; status: string }>,
): DigestStatistics {
  let immediate = 0;
  let daily = 0;
  let weekly = 0;
  let unknown = 0;
  let pendingDigest = 0;
  for (const row of payloads) {
    const mode = readDeliveryModeFromPayload(row.payloadJson, "immediate");
    if (mode === "daily") daily += 1;
    else if (mode === "weekly") weekly += 1;
    else if (mode === "immediate") immediate += 1;
    else unknown += 1;
    if (
      (mode === "daily" || mode === "weekly") &&
      (row.status === NotificationOutboxStatuses.pending ||
        row.status === NotificationOutboxStatuses.retry)
    ) {
      pendingDigest += 1;
    }
  }
  return { immediate, daily, weekly, unknown, pendingDigest };
}

async function countByOutboxStatus(): Promise<Record<string, number>> {
  const groups = await prisma.notificationOutbox.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  const counts: Record<string, number> = {};
  for (const g of groups) {
    counts[g.status] = g._count._all;
  }
  return counts;
}

/**
 * Builds durable analytics from Notification / NotificationOutbox tables.
 */
export async function generateNotificationAnalytics(): Promise<NotificationAnalyticsSnapshot> {
  const statusCounts = await countByOutboxStatus();
  const queue = buildQueueStatistics(statusCounts);

  const [notificationsCreated, notificationsDeleted, inAppNotifications, latencyRows, failureRows, retryRows, digestSample] =
    await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { deletedAt: { not: null } } }),
      prisma.notification.count({ where: { channel: "in_app", deletedAt: null } }),
      prisma.notificationOutbox.findMany({
        where: {
          status: {
            in: [NotificationOutboxStatuses.delivered, NotificationOutboxStatuses.sent],
          },
          sentAt: { not: null },
        },
        select: { createdAt: true, sentAt: true },
        take: 500,
        orderBy: { sentAt: "desc" },
      }),
      prisma.notificationOutbox.findMany({
        where: {
          status: {
            in: [NotificationOutboxStatuses.failed, NotificationOutboxStatuses.deadLetter],
          },
        },
        select: { lastError: true, status: true },
        take: 500,
        orderBy: { createdAt: "desc" },
      }),
      prisma.notificationOutbox.findMany({
        where: { status: NotificationOutboxStatuses.retry },
        select: { status: true, attempts: true },
        take: 500,
      }),
      prisma.notificationOutbox.findMany({
        select: { payloadJson: true, status: true },
        take: 1000,
        orderBy: { createdAt: "desc" },
      }),
    ]);

  const latency = calculateAverageDeliveryLatency(latencyRows);
  const delivered = queue.delivered;
  const sent = queue.sent;
  const failed = queue.failed;
  const deadLetter = queue.deadLetter;
  const totalOutbox = Object.values(statusCounts).reduce((a, b) => a + b, 0);
  const completed = delivered + sent;
  const attempted = completed + failed + deadLetter;
  const successRate = attempted === 0 ? null : Math.round((completed / attempted) * 10000) / 100;

  return {
    generatedAt: new Date().toISOString(),
    queue,
    delivery: {
      totalOutbox,
      delivered,
      sent,
      failed,
      deadLetter,
      successRate,
      averageDeliveryTimeMs: latency.averageDeliveryTimeMs,
      sampleSize: latency.sampleSize,
    },
    failures: buildFailureAnalysis(failureRows),
    retries: buildRetryAnalysis(retryRows),
    channels: {
      inAppNotifications,
      emailOutbox: totalOutbox,
      emailPendingLike: queue.depth,
      emailDelivered: delivered + sent,
    },
    digests: buildDigestStatistics(digestSample),
    notificationsCreated,
    notificationsDeleted,
  };
}
