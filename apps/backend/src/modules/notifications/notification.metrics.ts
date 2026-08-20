/**
 * In-process delivery metrics for the notification outbox worker.
 * Queue depth / connections are resolved when counter fns are provided.
 */

export type NotificationMetricSnapshot = {
  notificationsCreated: number;
  notificationsSent: number;
  notificationsDelivered: number;
  notificationsFailed: number;
  retryCount: number;
  deadLetterCount: number;
  digestVolume: number;
  averageDeliveryTimeMs: number | null;
  queueDepth: number;
  activeConnections: number;
};

export type QueueDepthFn = () => Promise<number>;
export type ActiveConnectionsFn = () => number;

const LATENCY_RING_SIZE = 200;

export class NotificationMetrics {
  private created = 0;
  private sent = 0;
  private delivered = 0;
  private failed = 0;
  private retries = 0;
  private deadLetters = 0;
  private digests = 0;
  private latencySamples: number[] = [];
  private queueDepthFn: QueueDepthFn | null = null;
  private activeConnectionsFn: ActiveConnectionsFn | null = null;

  setQueueDepthFn(fn: QueueDepthFn): void {
    this.queueDepthFn = fn;
  }

  setActiveConnectionsFn(fn: ActiveConnectionsFn): void {
    this.activeConnectionsFn = fn;
  }

  recordCreated(count = 1): void {
    this.created += count;
  }

  recordSent(count = 1): void {
    this.sent += count;
  }

  recordDelivered(count = 1, latencyMs?: number): void {
    this.delivered += count;
    if (typeof latencyMs === "number" && Number.isFinite(latencyMs) && latencyMs >= 0) {
      this.latencySamples.push(latencyMs);
      if (this.latencySamples.length > LATENCY_RING_SIZE) {
        this.latencySamples.shift();
      }
    }
  }

  recordFailed(count = 1): void {
    this.failed += count;
  }

  recordRetry(count = 1): void {
    this.retries += count;
  }

  recordDeadLetter(count = 1): void {
    this.deadLetters += count;
  }

  recordDigest(count = 1): void {
    this.digests += count;
  }

  averageDeliveryTimeMs(): number | null {
    return averageLatency(this.latencySamples);
  }

  async snapshot(): Promise<NotificationMetricSnapshot> {
    const queueDepth = this.queueDepthFn ? await this.queueDepthFn() : 0;
    const activeConnections = this.activeConnectionsFn ? this.activeConnectionsFn() : 0;
    return {
      notificationsCreated: this.created,
      notificationsSent: this.sent,
      notificationsDelivered: this.delivered,
      notificationsFailed: this.failed,
      retryCount: this.retries,
      deadLetterCount: this.deadLetters,
      digestVolume: this.digests,
      averageDeliveryTimeMs: this.averageDeliveryTimeMs(),
      queueDepth,
      activeConnections,
    };
  }

  /** Test helper */
  reset(): void {
    this.created = 0;
    this.sent = 0;
    this.delivered = 0;
    this.failed = 0;
    this.retries = 0;
    this.deadLetters = 0;
    this.digests = 0;
    this.latencySamples = [];
  }
}

export function averageLatency(samples: number[]): number | null {
  if (samples.length === 0) return null;
  const sum = samples.reduce((a, b) => a + b, 0);
  return Math.round(sum / samples.length);
}

export function computeDeliveryLatencyMs(createdAt: Date, deliveredAt: Date): number {
  return Math.max(0, deliveredAt.getTime() - createdAt.getTime());
}

export const notificationMetrics = new NotificationMetrics();
