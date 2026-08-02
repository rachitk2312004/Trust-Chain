import { createClient, type RedisClientType } from "redis";
import { prisma } from "@trustchain/database";
import { AppError } from "./errors.js";

type MemoryBucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, MemoryBucket>();
let redisClient: RedisClientType | null | undefined;

async function getRedis(): Promise<RedisClientType | null> {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    const client = createClient({ url });
    client.on("error", () => {
      /* fall through to DB/memory on command failure */
    });
    await client.connect();
    redisClient = client as RedisClientType;
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

async function assertViaRedis(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<"ok" | "limited" | "unavailable"> {
  const client = await getRedis();
  if (!client) return "unavailable";
  try {
    const redisKey = `rl:${key}`;
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pExpire(redisKey, windowMs);
    }
    if (count > maxRequests) return "limited";
    return "ok";
  } catch {
    return "unavailable";
  }
}

async function assertViaDatabase(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<"ok" | "limited" | "unavailable"> {
  try {
    const now = new Date();
    const existing = await prisma.rateLimitBucket.findUnique({ where: { bucketKey: key } });
    if (!existing || existing.expiresAt <= now) {
      const expiresAt = new Date(now.getTime() + windowMs);
      await prisma.rateLimitBucket.upsert({
        where: { bucketKey: key },
        create: {
          bucketKey: key,
          count: 1,
          windowStart: now,
          expiresAt,
        },
        update: {
          count: 1,
          windowStart: now,
          expiresAt,
        },
      });
      return "ok";
    }
    if (existing.count >= maxRequests) return "limited";
    await prisma.rateLimitBucket.update({
      where: { bucketKey: key },
      data: { count: { increment: 1 } },
    });
    return "ok";
  } catch {
    return "unavailable";
  }
}

function assertViaMemory(key: string, maxRequests: number, windowMs: number): "ok" | "limited" {
  const now = Date.now();
  const existing = memoryBuckets.get(key);
  if (!existing || existing.resetAt <= now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return "ok";
  }
  if (existing.count >= maxRequests) return "limited";
  existing.count += 1;
  return "ok";
}

/**
 * Layered rate limit: Redis → database → in-memory fallback.
 */
export async function assertRateLimit(input: {
  key: string;
  maxRequests: number;
  windowMs: number;
  errorCode?: string;
  message?: string;
}): Promise<void> {
  const redis = await assertViaRedis(input.key, input.maxRequests, input.windowMs);
  if (redis === "limited") {
    throw new AppError(
      429,
      input.errorCode ?? "RATE_LIMITED",
      input.message ?? "Rate limit exceeded",
    );
  }
  if (redis === "ok") return;

  const db = await assertViaDatabase(input.key, input.maxRequests, input.windowMs);
  if (db === "limited") {
    throw new AppError(
      429,
      input.errorCode ?? "RATE_LIMITED",
      input.message ?? "Rate limit exceeded",
    );
  }
  if (db === "ok") return;

  const mem = assertViaMemory(input.key, input.maxRequests, input.windowMs);
  if (mem === "limited") {
    throw new AppError(
      429,
      input.errorCode ?? "RATE_LIMITED",
      input.message ?? "Rate limit exceeded",
    );
  }
}

export function resetMemoryRateLimitBuckets(): void {
  memoryBuckets.clear();
}
