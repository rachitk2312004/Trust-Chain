import { MobileSyncPriorities, MobileSyncPriorityOrder } from "@trustchain/config";
import type { MobileSyncPriority, SyncJob } from "../types/mobile.types";
import { generateMobileId } from "../utils/ids";
import { mmkv } from "../cache/mmkv";

const QUEUE_KEY = "tc.mobile.sync.queue";

const PRIORITY_WEIGHT: Record<MobileSyncPriority, number> = {
  [MobileSyncPriorities.critical]: 0,
  [MobileSyncPriorities.high]: 1,
  [MobileSyncPriorities.normal]: 2,
  [MobileSyncPriorities.low]: 3,
  [MobileSyncPriorities.background]: 4,
};

export function compareSyncPriority(a: MobileSyncPriority, b: MobileSyncPriority): number {
  return PRIORITY_WEIGHT[a] - PRIORITY_WEIGHT[b];
}

export function sortJobsByPriority(jobs: SyncJob[]): SyncJob[] {
  return [...jobs].sort((a, b) => {
    const p = compareSyncPriority(a.priority, b.priority);
    if (p !== 0) return p;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

async function readQueue(): Promise<SyncJob[]> {
  const raw = await mmkv.getString(QUEUE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SyncJob[];
  } catch {
    return [];
  }
}

async function writeQueue(jobs: SyncJob[]): Promise<void> {
  await mmkv.set(QUEUE_KEY, JSON.stringify(jobs));
}

export async function enqueueSyncJob(input: {
  kind: string;
  priority?: MobileSyncPriority;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}): Promise<SyncJob> {
  const job: SyncJob = {
    id: generateMobileId("event"),
    priority: input.priority ?? MobileSyncPriorities.normal,
    kind: input.kind,
    payload: input.payload ?? {},
    attempts: 0,
    maxAttempts: input.maxAttempts ?? 5,
    createdAt: new Date().toISOString(),
  };
  const queue = await readQueue();
  queue.push(job);
  await writeQueue(sortJobsByPriority(queue));
  return job;
}

export async function getQueueDepth(): Promise<number> {
  return (await readQueue()).length;
}

export async function listSyncJobs(): Promise<SyncJob[]> {
  return sortJobsByPriority(await readQueue());
}

export type SyncHandler = (job: SyncJob) => Promise<void>;

export async function processSyncQueue(
  handler: SyncHandler,
  onLatency?: (ms: number) => void,
): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;
  const queue = sortJobsByPriority(await readQueue());
  const remaining: SyncJob[] = [];

  for (const job of queue) {
    const started = Date.now();
    try {
      await handler(job);
      processed += 1;
      onLatency?.(Date.now() - started);
    } catch (error) {
      failed += 1;
      const next: SyncJob = {
        ...job,
        attempts: job.attempts + 1,
        lastError: error instanceof Error ? error.message : "sync_failed",
      };
      if (next.attempts < next.maxAttempts) remaining.push(next);
    }
  }

  await writeQueue(sortJobsByPriority(remaining));
  return { processed, failed };
}

export function nextRetryDelayMs(attempts: number): number {
  return Math.min(60_000, 1_000 * 2 ** Math.max(0, attempts));
}

export { MobileSyncPriorityOrder };
