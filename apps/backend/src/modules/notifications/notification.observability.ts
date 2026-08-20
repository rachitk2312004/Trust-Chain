import { notificationConnections } from "./notification.connection.js";
import { generateNotificationAnalytics } from "./notification.analytics.js";
import { notificationMetrics } from "./notification.metrics.js";
import { countOutboxQueueDepth } from "./notification.repository.js";

let wired = false;

/** Wire live counters used by metrics snapshots (idempotent). */
export function ensureNotificationObservabilityWired(): void {
  if (wired) return;
  notificationMetrics.setQueueDepthFn(() => countOutboxQueueDepth());
  notificationMetrics.setActiveConnectionsFn(() => notificationConnections.connectionCount());
  wired = true;
}

export type ObservabilitySnapshot = {
  generatedAt: string;
  process: Awaited<ReturnType<typeof notificationMetrics.snapshot>>;
  durable: Awaited<ReturnType<typeof generateNotificationAnalytics>>;
  connections: {
    active: number;
  };
};

/**
 * Combined process metrics + durable DB analytics for ops dashboards.
 */
export async function getNotificationObservability(): Promise<ObservabilitySnapshot> {
  ensureNotificationObservabilityWired();
  const [process, durable] = await Promise.all([
    notificationMetrics.snapshot(),
    generateNotificationAnalytics(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    process,
    durable,
    connections: {
      active: notificationConnections.connectionCount(),
    },
  };
}
