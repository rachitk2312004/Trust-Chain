import { listPublishedEvents } from "../publishers/index.js";

export type RetentionPolicy = {
  maxEvents: number;
  maxAgeMs: number;
};

export function applyEventRetention(policy: RetentionPolicy): number {
  const events = listPublishedEvents();
  const cutoff = Date.now() - policy.maxAgeMs;
  const kept = events.filter(
    (event, index) =>
      index >= events.length - policy.maxEvents && new Date(event.publishedAt).getTime() >= cutoff,
  );
  return events.length - kept.length;
}

export function describeEventRetention(policy: RetentionPolicy): RetentionPolicy {
  return { ...policy };
}
