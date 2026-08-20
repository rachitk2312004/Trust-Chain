import { DefaultDeveloperApiQuotaLimits } from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";

export type DeveloperQuotaLimits = {
  requestsPerDay: number;
  requestsPerMonth: number;
  maxApiKeys: number;
  maxWebhooks: number;
  maxServiceAccounts: number;
};

export type DeveloperQuotaUsage = {
  requestsToday: number;
  requestsMonth: number;
  apiKeys: number;
  webhooks: number;
  serviceAccounts: number;
};

export type QuotaUtilization = {
  key: keyof DeveloperQuotaLimits;
  limit: number;
  used: number;
  ratio: number;
  exhausted: boolean;
};

export function defaultDeveloperQuotaLimits(
  overrides?: Partial<DeveloperQuotaLimits> | null,
): DeveloperQuotaLimits {
  return {
    requestsPerDay: overrides?.requestsPerDay ?? DefaultDeveloperApiQuotaLimits.requestsPerDay,
    requestsPerMonth:
      overrides?.requestsPerMonth ?? DefaultDeveloperApiQuotaLimits.requestsPerMonth,
    maxApiKeys: overrides?.maxApiKeys ?? DefaultDeveloperApiQuotaLimits.maxApiKeys,
    maxWebhooks: overrides?.maxWebhooks ?? DefaultDeveloperApiQuotaLimits.maxWebhooks,
    maxServiceAccounts:
      overrides?.maxServiceAccounts ?? DefaultDeveloperApiQuotaLimits.maxServiceAccounts,
  };
}

export function parseDeveloperQuotaLimits(value: unknown): DeveloperQuotaLimits {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return defaultDeveloperQuotaLimits({
    requestsPerDay:
      typeof raw.requestsPerDay === "number" ? Math.floor(raw.requestsPerDay) : undefined,
    requestsPerMonth:
      typeof raw.requestsPerMonth === "number" ? Math.floor(raw.requestsPerMonth) : undefined,
    maxApiKeys: typeof raw.maxApiKeys === "number" ? Math.floor(raw.maxApiKeys) : undefined,
    maxWebhooks: typeof raw.maxWebhooks === "number" ? Math.floor(raw.maxWebhooks) : undefined,
    maxServiceAccounts:
      typeof raw.maxServiceAccounts === "number" ? Math.floor(raw.maxServiceAccounts) : undefined,
  });
}

export function parseDeveloperQuotaUsage(value: unknown): DeveloperQuotaUsage {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    requestsToday: typeof raw.requestsToday === "number" ? raw.requestsToday : 0,
    requestsMonth: typeof raw.requestsMonth === "number" ? raw.requestsMonth : 0,
    apiKeys: typeof raw.apiKeys === "number" ? raw.apiKeys : 0,
    webhooks: typeof raw.webhooks === "number" ? raw.webhooks : 0,
    serviceAccounts: typeof raw.serviceAccounts === "number" ? raw.serviceAccounts : 0,
  };
}

export function computeQuotaUtilization(
  limits: DeveloperQuotaLimits,
  usage: DeveloperQuotaUsage,
): QuotaUtilization[] {
  const pairs: Array<[keyof DeveloperQuotaLimits, number]> = [
    ["requestsPerDay", usage.requestsToday],
    ["requestsPerMonth", usage.requestsMonth],
    ["maxApiKeys", usage.apiKeys],
    ["maxWebhooks", usage.webhooks],
    ["maxServiceAccounts", usage.serviceAccounts],
  ];
  return pairs.map(([key, used]) => {
    const limit = Math.max(0, limits[key]);
    const ratio = limit === 0 ? 1 : used / limit;
    return {
      key,
      limit,
      used,
      ratio: Math.round(ratio * 1000) / 1000,
      exhausted: used >= limit,
    };
  });
}

export function isQuotaExhausted(
  limits: DeveloperQuotaLimits,
  usage: DeveloperQuotaUsage,
  keys: Array<keyof DeveloperQuotaLimits> = ["requestsPerDay", "requestsPerMonth"],
): boolean {
  const util = computeQuotaUtilization(limits, usage);
  return util.some((row) => keys.includes(row.key) && row.exhausted);
}

export function assertRequestQuota(
  limits: DeveloperQuotaLimits,
  usage: DeveloperQuotaUsage,
): void {
  if (usage.requestsToday >= limits.requestsPerDay) {
    throw new AppError(429, "DEVELOPER_QUOTA_EXCEEDED", "Daily API request quota exhausted");
  }
  if (usage.requestsMonth >= limits.requestsPerMonth) {
    throw new AppError(429, "DEVELOPER_QUOTA_EXCEEDED", "Monthly API request quota exhausted");
  }
}

export function assertResourceQuota(
  limits: DeveloperQuotaLimits,
  usage: DeveloperQuotaUsage,
  resource: "maxApiKeys" | "maxWebhooks" | "maxServiceAccounts",
): void {
  const used =
    resource === "maxApiKeys"
      ? usage.apiKeys
      : resource === "maxWebhooks"
        ? usage.webhooks
        : usage.serviceAccounts;
  if (used >= limits[resource]) {
    throw new AppError(429, "DEVELOPER_QUOTA_EXCEEDED", `${resource} quota exhausted`);
  }
}

export function toPublicDeveloperQuota(row: {
  id: string;
  organizationId: string;
  limitsJson: Prisma.JsonValue;
  usageJson: Prisma.JsonValue | null;
  exhaustedAt: Date | null;
  updatedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const limits = parseDeveloperQuotaLimits(row.limitsJson);
  const usage = parseDeveloperQuotaUsage(row.usageJson);
  const utilization = computeQuotaUtilization(limits, usage);
  return {
    id: row.id,
    organizationId: row.organizationId,
    limits,
    usage,
    utilization,
    exhausted: utilization.some((u) => u.exhausted),
    exhaustedAt: row.exhaustedAt?.toISOString() ?? null,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function measureDeveloperQuotaUsage(
  organizationId: string,
  now = new Date(),
): Promise<DeveloperQuotaUsage> {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [requestsToday, requestsMonth, apiKeys, webhooks, serviceAccounts] = await Promise.all([
    prisma.apiUsageEvent.count({
      where: { organizationId, createdAt: { gte: startOfDay } },
    }),
    prisma.apiUsageEvent.count({
      where: { organizationId, createdAt: { gte: startOfMonth } },
    }),
    prisma.apiKey.count({ where: { organizationId } }),
    prisma.webhookEndpoint.count({ where: { organizationId } }),
    prisma.serviceAccount.count({ where: { organizationId } }),
  ]);

  return { requestsToday, requestsMonth, apiKeys, webhooks, serviceAccounts };
}

export async function getOrCreateDeveloperQuota(organizationId: string) {
  const existing = await prisma.developerApiQuota.findUnique({
    where: { organizationId },
  });
  if (existing) return existing;

  const limits = defaultDeveloperQuotaLimits();
  const usage = await measureDeveloperQuotaUsage(organizationId);
  return prisma.developerApiQuota.create({
    data: {
      organizationId,
      limitsJson: limits as unknown as Prisma.InputJsonValue,
      usageJson: usage as unknown as Prisma.InputJsonValue,
      exhaustedAt: isQuotaExhausted(limits, usage) ? new Date() : null,
    },
  });
}

export async function refreshDeveloperQuotaUsage(organizationId: string, updatedById?: string) {
  const row = await getOrCreateDeveloperQuota(organizationId);
  const limits = parseDeveloperQuotaLimits(row.limitsJson);
  const usage = await measureDeveloperQuotaUsage(organizationId);
  const exhausted = isQuotaExhausted(limits, usage);
  return prisma.developerApiQuota.update({
    where: { id: row.id },
    data: {
      usageJson: usage as unknown as Prisma.InputJsonValue,
      exhaustedAt: exhausted ? row.exhaustedAt ?? new Date() : null,
      ...(updatedById ? { updatedById } : {}),
    },
  });
}

export async function updateDeveloperQuotaLimits(
  quotaId: string,
  limits: Partial<DeveloperQuotaLimits>,
  updatedById: string,
) {
  const existing = await prisma.developerApiQuota.findUnique({ where: { id: quotaId } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Developer quota not found");

  const nextLimits = defaultDeveloperQuotaLimits({
    ...parseDeveloperQuotaLimits(existing.limitsJson),
    ...limits,
  });
  const usage = await measureDeveloperQuotaUsage(existing.organizationId);
  const exhausted = isQuotaExhausted(nextLimits, usage);

  return prisma.developerApiQuota.update({
    where: { id: quotaId },
    data: {
      limitsJson: nextLimits as unknown as Prisma.InputJsonValue,
      usageJson: usage as unknown as Prisma.InputJsonValue,
      exhaustedAt: exhausted ? new Date() : null,
      updatedById,
    },
  });
}

export async function assertOrganizationRequestQuota(organizationId: string): Promise<void> {
  const row = await getOrCreateDeveloperQuota(organizationId);
  const limits = parseDeveloperQuotaLimits(row.limitsJson);
  const usage = await measureDeveloperQuotaUsage(organizationId);
  assertRequestQuota(limits, usage);
}

export async function assertOrganizationResourceQuota(
  organizationId: string,
  resource: "maxApiKeys" | "maxWebhooks" | "maxServiceAccounts",
): Promise<void> {
  const row = await getOrCreateDeveloperQuota(organizationId);
  const limits = parseDeveloperQuotaLimits(row.limitsJson);
  const usage = await measureDeveloperQuotaUsage(organizationId);
  assertResourceQuota(limits, usage, resource);
}
