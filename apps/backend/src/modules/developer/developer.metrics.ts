import { prisma } from "@trustchain/database";

export type RecordApiUsageInput = {
  organizationId: string;
  apiKeyId?: string | null;
  serviceAccountId?: string | null;
  method: string;
  path: string;
  statusCode: number;
  scope?: string | null;
  requestId?: string | null;
  durationMs?: number | null;
};

export async function recordApiUsage(input: RecordApiUsageInput) {
  return prisma.apiUsageEvent.create({
    data: {
      organizationId: input.organizationId,
      apiKeyId: input.apiKeyId ?? null,
      serviceAccountId: input.serviceAccountId ?? null,
      method: input.method.toUpperCase(),
      path: input.path.slice(0, 500),
      statusCode: input.statusCode,
      scope: input.scope ?? null,
      requestId: input.requestId ?? null,
      durationMs: input.durationMs ?? null,
    },
  });
}

export function toPublicUsageEvent(row: {
  id: string;
  organizationId: string;
  apiKeyId: string | null;
  serviceAccountId: string | null;
  method: string;
  path: string;
  statusCode: number;
  scope: string | null;
  requestId: string | null;
  durationMs: number | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    apiKeyId: row.apiKeyId,
    serviceAccountId: row.serviceAccountId,
    method: row.method,
    path: row.path,
    statusCode: row.statusCode,
    scope: row.scope,
    requestId: row.requestId,
    durationMs: row.durationMs,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listApiUsageEvents(input: {
  organizationId: string;
  apiKeyId?: string;
  limit?: number;
  offset?: number;
}) {
  const where = {
    organizationId: input.organizationId,
    ...(input.apiKeyId ? { apiKeyId: input.apiKeyId } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.apiUsageEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 50,
      skip: input.offset ?? 0,
    }),
    prisma.apiUsageEvent.count({ where }),
  ]);
  return { items, total };
}

export async function getUsageMetrics(organizationId: string, since?: Date) {
  const createdAt = since ? { gte: since } : undefined;
  const where = { organizationId, ...(createdAt ? { createdAt } : {}) };

  const [total, success, clientError, serverError, byMethod] = await Promise.all([
    prisma.apiUsageEvent.count({ where }),
    prisma.apiUsageEvent.count({
      where: { ...where, statusCode: { gte: 200, lt: 300 } },
    }),
    prisma.apiUsageEvent.count({
      where: { ...where, statusCode: { gte: 400, lt: 500 } },
    }),
    prisma.apiUsageEvent.count({
      where: { ...where, statusCode: { gte: 500 } },
    }),
    prisma.apiUsageEvent.groupBy({
      by: ["method"],
      where,
      _count: { _all: true },
    }),
  ]);

  const avg = await prisma.apiUsageEvent.aggregate({
    where,
    _avg: { durationMs: true },
  });

  return {
    organizationId,
    windowStart: since?.toISOString() ?? null,
    totals: {
      requests: total,
      success,
      clientError,
      serverError,
      avgDurationMs: avg._avg.durationMs ? Math.round(avg._avg.durationMs) : null,
    },
    byMethod: byMethod.map((row) => ({
      method: row.method,
      count: row._count._all,
    })),
  };
}
