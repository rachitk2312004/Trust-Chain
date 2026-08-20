import {
  DefaultTenantQuotaLimits,
  TenantLifecycleStatuses,
  TenantLifecycleStatusList,
} from "@trustchain/config";

export type TenantLifecycleStatus =
  (typeof TenantLifecycleStatuses)[keyof typeof TenantLifecycleStatuses];

export type TenantQuotaLimits = {
  users: number;
  organizations: number;
  documents: number;
  certificates: number;
  signatures: number;
  storageBytes: number;
};

export type TenantQuotaUsage = TenantQuotaLimits;

export type TenantQuotaResource = keyof TenantQuotaLimits;

export type LifecycleAction = "suspend" | "restore" | "archive" | "transfer";

const ALLOWED_TRANSITIONS: Record<LifecycleAction, Partial<Record<string, TenantLifecycleStatus>>> =
  {
    suspend: {
      [TenantLifecycleStatuses.active]: TenantLifecycleStatuses.suspended,
      [TenantLifecycleStatuses.transferred]: TenantLifecycleStatuses.suspended,
      disabled: TenantLifecycleStatuses.suspended,
    },
    restore: {
      [TenantLifecycleStatuses.suspended]: TenantLifecycleStatuses.active,
      [TenantLifecycleStatuses.archived]: TenantLifecycleStatuses.active,
      [TenantLifecycleStatuses.transferred]: TenantLifecycleStatuses.active,
      disabled: TenantLifecycleStatuses.active,
    },
    archive: {
      [TenantLifecycleStatuses.active]: TenantLifecycleStatuses.archived,
      [TenantLifecycleStatuses.suspended]: TenantLifecycleStatuses.archived,
      [TenantLifecycleStatuses.transferred]: TenantLifecycleStatuses.archived,
      disabled: TenantLifecycleStatuses.archived,
    },
    transfer: {
      [TenantLifecycleStatuses.active]: TenantLifecycleStatuses.transferred,
      [TenantLifecycleStatuses.suspended]: TenantLifecycleStatuses.transferred,
      [TenantLifecycleStatuses.transferred]: TenantLifecycleStatuses.transferred,
    },
  };

export function normalizeTenantStatus(status: string): string {
  if (status === "disabled") return TenantLifecycleStatuses.suspended;
  return status;
}

export function isTenantLifecycleStatus(value: string): value is TenantLifecycleStatus {
  return (TenantLifecycleStatusList as string[]).includes(value);
}

export function resolveLifecycleTransition(
  action: LifecycleAction,
  currentStatus: string,
): { ok: true; fromStatus: string; toStatus: TenantLifecycleStatus } | { ok: false; reason: string } {
  const fromStatus = normalizeTenantStatus(currentStatus);
  const toStatus = ALLOWED_TRANSITIONS[action][fromStatus] ?? ALLOWED_TRANSITIONS[action][currentStatus];
  if (!toStatus) {
    return {
      ok: false,
      reason: `Cannot ${action} tenant in status '${currentStatus}'`,
    };
  }
  return { ok: true, fromStatus: currentStatus, toStatus };
}

export function defaultTenantQuotaLimits(
  overrides?: Partial<TenantQuotaLimits> | null,
): TenantQuotaLimits {
  return {
    users: overrides?.users ?? DefaultTenantQuotaLimits.users,
    organizations: overrides?.organizations ?? DefaultTenantQuotaLimits.organizations,
    documents: overrides?.documents ?? DefaultTenantQuotaLimits.documents,
    certificates: overrides?.certificates ?? DefaultTenantQuotaLimits.certificates,
    signatures: overrides?.signatures ?? DefaultTenantQuotaLimits.signatures,
    storageBytes: overrides?.storageBytes ?? DefaultTenantQuotaLimits.storageBytes,
  };
}

export function parseTenantQuotaLimits(value: unknown): TenantQuotaLimits {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const num = (key: TenantQuotaResource, fallback: number) => {
    const v = raw[key];
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
  };
  return {
    users: num("users", DefaultTenantQuotaLimits.users),
    organizations: num("organizations", DefaultTenantQuotaLimits.organizations),
    documents: num("documents", DefaultTenantQuotaLimits.documents),
    certificates: num("certificates", DefaultTenantQuotaLimits.certificates),
    signatures: num("signatures", DefaultTenantQuotaLimits.signatures),
    storageBytes: num("storageBytes", DefaultTenantQuotaLimits.storageBytes),
  };
}

export function emptyTenantQuotaUsage(): TenantQuotaUsage {
  return {
    users: 0,
    organizations: 0,
    documents: 0,
    certificates: 0,
    signatures: 0,
    storageBytes: 0,
  };
}

export type QuotaEnforcementResult =
  | { ok: true; resource: TenantQuotaResource; usage: number; limit: number; remaining: number }
  | {
      ok: false;
      resource: TenantQuotaResource;
      usage: number;
      limit: number;
      remaining: number;
      reason: string;
    };

/**
 * Soft-check: whether allocating `delta` more of `resource` stays within limits.
 * Limit `0` means unlimited.
 */
export function enforceTenantQuota(
  limits: TenantQuotaLimits,
  usage: TenantQuotaUsage,
  resource: TenantQuotaResource,
  delta = 1,
): QuotaEnforcementResult {
  const limit = limits[resource];
  const current = usage[resource];
  const next = current + delta;
  if (limit === 0) {
    return { ok: true, resource, usage: current, limit, remaining: Number.POSITIVE_INFINITY };
  }
  const remaining = Math.max(0, limit - current);
  if (next > limit) {
    return {
      ok: false,
      resource,
      usage: current,
      limit,
      remaining,
      reason: `Tenant quota exceeded for ${resource}: ${current}+${delta} > ${limit}`,
    };
  }
  return { ok: true, resource, usage: current, limit, remaining: Math.max(0, limit - next) };
}

export function assertTenantQuotas(
  limits: TenantQuotaLimits,
  usage: TenantQuotaUsage,
  checks: Array<{ resource: TenantQuotaResource; delta?: number }>,
): QuotaEnforcementResult[] {
  return checks.map((c) => enforceTenantQuota(limits, usage, c.resource, c.delta ?? 1));
}

export function quotaUtilization(limits: TenantQuotaLimits, usage: TenantQuotaUsage) {
  const rows = (Object.keys(limits) as TenantQuotaResource[]).map((resource) => {
    const limit = limits[resource];
    const used = usage[resource];
    const ratio = limit <= 0 ? null : Math.round((used / limit) * 10000) / 100;
    return { resource, used, limit, percent: ratio };
  });
  return rows;
}

export function slugifyTenantName(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
