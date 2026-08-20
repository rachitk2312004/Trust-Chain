import { AdminAuditActions, RoleKeys, SystemConfigKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { toPublicAudit, writeAdminAudit } from "./admin.audit.js";
import * as repo from "./admin.repository.js";

export type ConfigurationHistoryEntry = {
  auditId: string;
  key: string;
  action: string;
  previousValue: unknown;
  newValue: unknown;
  description: string | null;
  actorUserId: string | null;
  createdAt: string;
  rolledBack?: boolean;
};

export function extractConfigurationHistoryMeta(meta: unknown): {
  key: string | null;
  previousValue: unknown;
  newValue: unknown;
  description: string | null;
  rolledBack: boolean;
} {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) {
    return {
      key: null,
      previousValue: undefined,
      newValue: undefined,
      description: null,
      rolledBack: false,
    };
  }
  const record = meta as Record<string, unknown>;
  return {
    key: typeof record.key === "string" ? record.key : null,
    previousValue: record.previousValue,
    newValue: record.newValue,
    description: typeof record.description === "string" ? record.description : null,
    rolledBack: record.rolledBack === true,
  };
}

export function filterConfigurationHistory(
  events: Array<{
    id: string;
    action: string;
    actorUserId: string | null;
    meta: unknown;
    createdAt: string;
  }>,
  options?: { key?: string },
): ConfigurationHistoryEntry[] {
  const entries: ConfigurationHistoryEntry[] = [];
  for (const event of events) {
    if (
      event.action !== AdminAuditActions.configurationUpdate &&
      event.action !== AdminAuditActions.configurationRollback
    ) {
      continue;
    }
    const parsed = extractConfigurationHistoryMeta(event.meta);
    if (!parsed.key) continue;
    if (options?.key && parsed.key !== options.key) continue;
    entries.push({
      auditId: event.id,
      key: parsed.key,
      action: event.action,
      previousValue: parsed.previousValue,
      newValue: parsed.newValue,
      description: parsed.description,
      actorUserId: event.actorUserId,
      createdAt: event.createdAt,
      rolledBack: parsed.rolledBack || event.action === AdminAuditActions.configurationRollback,
    });
  }
  return entries;
}

export function resolveRollbackValue(entry: ConfigurationHistoryEntry): unknown {
  if (entry.previousValue === undefined) {
    throw new Error("Rollback entry is missing previousValue");
  }
  return entry.previousValue;
}

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

export async function listConfigurationHistory(
  actorId: string,
  query: { key?: string; limit: number; offset: number },
) {
  await assertSuperAdmin(actorId);

  // Fetch a wider audit window then filter — meta key filtering is in-process.
  const take = Math.min(Math.max(query.limit + query.offset, query.limit) * 3, 500);
  const result = await repo.listAuditLogs({
    limit: take,
    offset: 0,
  });

  const events = result.items
    .filter(
      (row) =>
        row.action === AdminAuditActions.configurationUpdate ||
        row.action === AdminAuditActions.configurationRollback,
    )
    .map(toPublicAudit);

  const filtered = filterConfigurationHistory(events, { key: query.key });
  const slice = filtered.slice(query.offset, query.offset + query.limit);

  return {
    history: slice,
    total: filtered.length,
    limit: query.limit,
    offset: query.offset,
    knownKeys: Object.values(SystemConfigKeys),
  };
}

export async function updateConfigurationWithHistory(
  actorId: string,
  input: { key: string; value: unknown; description?: string | null },
) {
  await assertSuperAdmin(actorId);
  const existing = await repo.getConfigurationByKey(input.key);
  const previousValue = existing ? existing.valueJson : null;

  const config = await repo.upsertConfiguration({
    key: input.key,
    value: input.value as never,
    description: input.description,
    updatedById: actorId,
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.configurationUpdate,
    targetType: "system_configuration",
    targetId: config.id,
    meta: {
      key: input.key,
      previousValue,
      newValue: input.value,
      description: input.description ?? existing?.description ?? null,
    },
  });

  return { configuration: repo.toPublicConfiguration(config) };
}

export async function rollbackConfiguration(
  actorId: string,
  input: { key: string; auditId: string },
) {
  await assertSuperAdmin(actorId);

  const history = await listConfigurationHistory(actorId, {
    key: input.key,
    limit: 200,
    offset: 0,
  });
  const entry = history.history.find((h) => h.auditId === input.auditId);
  if (!entry) {
    throw new AppError(404, "HISTORY_NOT_FOUND", "Configuration history entry not found");
  }
  if (entry.key !== input.key) {
    throw new AppError(400, "KEY_MISMATCH", "Audit entry key does not match rollback key");
  }

  let previousValue: unknown;
  try {
    previousValue = resolveRollbackValue(entry);
  } catch {
    throw new AppError(
      409,
      "ROLLBACK_UNAVAILABLE",
      "Cannot rollback: previous value was not recorded on this audit entry",
    );
  }

  const existing = await repo.getConfigurationByKey(input.key);
  const config = await repo.upsertConfiguration({
    key: input.key,
    value: previousValue as never,
    description: entry.description,
    updatedById: actorId,
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.configurationRollback,
    targetType: "system_configuration",
    targetId: config.id,
    meta: {
      key: input.key,
      previousValue: existing?.valueJson ?? null,
      newValue: previousValue,
      description: entry.description,
      rolledBack: true,
      sourceAuditId: input.auditId,
    },
  });

  return {
    configuration: repo.toPublicConfiguration(config),
    rolledBackFromAuditId: input.auditId,
    restoredValue: previousValue,
  };
}
