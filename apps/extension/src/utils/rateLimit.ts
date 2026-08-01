import { ExtensionRateLimit } from "@trustchain/config";

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export function assertClientRateLimit(key = "default"): void {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => now - t < ExtensionRateLimit.windowMs);
  if (bucket.timestamps.length >= ExtensionRateLimit.maxRequests) {
    buckets.set(key, bucket);
    throw new Error("EXT_RATE_LIMITED");
  }
  bucket.timestamps.push(now);
  buckets.set(key, bucket);
}

export function resetClientRateLimit(): void {
  buckets.clear();
}
