import { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { recordDbQuery } from "./requestPerf.js";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/** Cap pool size for remote DB — avoids exhausting Render + Prisma pool queue storms. */
function resolveDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;
  if (raw.includes("connection_limit=")) return raw;
  const limit = process.env.DATABASE_CONNECTION_LIMIT ?? "5";
  const separator = raw.includes("?") ? "&" : "?";
  return `${raw}${separator}connection_limit=${limit}&pool_timeout=20`;
}

function createPrismaClient(): PrismaClient {
  const url = resolveDatabaseUrl();
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    ...(url ? { datasources: { db: { url } } } : {}),
  });

  if (process.env.PERF_LOG !== "1") {
    return base;
  }

  return base.$extends({
    query: {
      $allOperations({ model, operation, args, query }) {
        const started = process.hrtime.bigint();
        return query(args).then((result) => {
          const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
          recordDbQuery(durationMs, { model, operation });
          return result;
        });
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export {
  runWithPerfAccumulator,
  recordAuthCacheHit,
  type RequestPerfAccumulator,
  type DbQueryRecord,
} from "./requestPerf.js";

export { PrismaClient, Prisma };
export type * from "@prisma/client";
