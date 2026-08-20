import { NotificationDeliveryDefaults, NotificationDigestModes } from "@trustchain/config";
import {
  cleanupStaleProcessing,
  processDigestBatch,
  processImmediateOutboxBatch,
} from "./notification.worker.js";
import { ensureNotificationObservabilityWired } from "./notification.observability.js";
import { runNotificationRetentionCleanup } from "./notification.retention.js";

export type SchedulerTickResult = {
  outbox: Awaited<ReturnType<typeof processImmediateOutboxBatch>>;
  dailyDigest: Awaited<ReturnType<typeof processDigestBatch>>;
  weeklyDigest: Awaited<ReturnType<typeof processDigestBatch>>;
  staleReclaimed: number;
  retention: Awaited<ReturnType<typeof runNotificationRetentionCleanup>> | null;
};

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;
let retentionTickCounter = 0;

/**
 * One scheduler tick: poll outbox, generate digests, reclaim stale processing.
 * Retention runs every 120 ticks when NOTIFICATION_RETENTION_ENABLED=true.
 */
export async function runNotificationSchedulerTick(
  now = new Date(),
): Promise<SchedulerTickResult> {
  const outbox = await processImmediateOutboxBatch(
    NotificationDeliveryDefaults.batchSize,
    now,
  );
  const dailyDigest = await processDigestBatch(NotificationDigestModes.daily, now);
  const weeklyDigest = await processDigestBatch(NotificationDigestModes.weekly, now);
  const staleReclaimed = await cleanupStaleProcessing(now);

  let retention: SchedulerTickResult["retention"] = null;
  const retentionEnabled =
    process.env.NOTIFICATION_RETENTION_ENABLED === "true" ||
    process.env.NOTIFICATION_RETENTION_ENABLED === "1";
  if (retentionEnabled) {
    retentionTickCounter += 1;
    if (retentionTickCounter >= 120) {
      retentionTickCounter = 0;
      retention = await runNotificationRetentionCleanup(undefined, now);
    }
  }

  return { outbox, dailyDigest, weeklyDigest, staleReclaimed, retention };
}

export function isNotificationSchedulerRunning(): boolean {
  return timer != null;
}

/**
 * Starts polling when NOTIFICATION_WORKER_ENABLED=true (or force=true for tests).
 */
export function startNotificationScheduler(options?: {
  intervalMs?: number;
  force?: boolean;
}): void {
  if (timer) return;
  const enabled =
    options?.force === true ||
    process.env.NOTIFICATION_WORKER_ENABLED === "true" ||
    process.env.NOTIFICATION_WORKER_ENABLED === "1";
  if (!enabled) return;

  ensureNotificationObservabilityWired();

  const intervalMs = options?.intervalMs ?? NotificationDeliveryDefaults.pollIntervalMs;
  timer = setInterval(() => {
    if (running) return;
    running = true;
    void runNotificationSchedulerTick()
      .catch((err: unknown) => {
        console.error("[notifications] scheduler tick failed", err);
      })
      .finally(() => {
        running = false;
      });
  }, intervalMs);

  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }

  console.log(`[notifications] delivery scheduler started (interval=${intervalMs}ms)`);
}

export function stopNotificationScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  running = false;
}
