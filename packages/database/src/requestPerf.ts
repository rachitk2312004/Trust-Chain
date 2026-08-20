import { AsyncLocalStorage } from "node:async_hooks";

/** Per-request timing accumulator (AsyncLocalStorage — safe under concurrent requests). */
export type DbQueryRecord = {
  model: string;
  operation: string;
  durationMs: number;
};

export type RequestPerfAccumulator = {
  requestId: string;
  authMs: number;
  authCacheHit: boolean;
  dbMs: number;
  dbQueries: number;
  queryLog: DbQueryRecord[];
};

const perfStorage = new AsyncLocalStorage<RequestPerfAccumulator>();

/** @deprecated use runWithPerfAccumulator — kept for middleware cleanup hooks */
export function setRequestPerfAccumulator(_next: RequestPerfAccumulator | null): void {
  // no-op; context is scoped via AsyncLocalStorage.run
}

export function runWithPerfAccumulator<T>(
  accumulator: RequestPerfAccumulator,
  fn: () => T,
): T {
  return perfStorage.run(accumulator, fn);
}

export function getRequestPerfAccumulator(): RequestPerfAccumulator | null {
  return perfStorage.getStore() ?? null;
}

export function recordDbQuery(
  durationMs: number,
  meta?: { model?: string; operation?: string },
): void {
  const accumulator = perfStorage.getStore();
  if (!accumulator) return;
  accumulator.dbMs += durationMs;
  accumulator.dbQueries += 1;
  if (meta?.model && meta?.operation) {
    accumulator.queryLog.push({
      model: meta.model,
      operation: meta.operation,
      durationMs,
    });
  }
}

export function recordAuthCacheHit(hit: boolean): void {
  const accumulator = perfStorage.getStore();
  if (!accumulator) return;
  accumulator.authCacheHit = hit;
}
