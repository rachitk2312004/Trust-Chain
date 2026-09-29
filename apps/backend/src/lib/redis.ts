import { createClient, type RedisClientType } from "redis";

let redisClient: RedisClientType | null | undefined;

export async function getRedis(): Promise<RedisClientType | null> {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    const client = createClient({ url });
    client.on("error", () => {
      /* command callers fall back */
    });
    await client.connect();
    redisClient = client as RedisClientType;
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

export function resetRedisClientForTests(): void {
  redisClient = undefined;
}
