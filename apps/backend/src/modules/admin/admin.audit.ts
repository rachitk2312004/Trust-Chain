import { prisma, type Prisma } from "@trustchain/database";

export type WriteAdminAuditInput = {
  actorUserId?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  organizationId?: string | null;
  success?: boolean;
  meta?: Record<string, unknown> | null;
};

export async function writeAdminAudit(input: WriteAdminAuditInput) {
  return prisma.adminAuditLog.create({
    data: {
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      targetType: input.targetType ?? null,
      targetId: input.targetId ?? null,
      organizationId: input.organizationId ?? null,
      success: input.success ?? true,
      metaJson: (input.meta as Prisma.InputJsonValue) ?? undefined,
    },
  });
}

export function toPublicAudit(row: {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  organizationId: string | null;
  success: boolean;
  metaJson: Prisma.JsonValue | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    actorUserId: row.actorUserId,
    action: row.action,
    targetType: row.targetType,
    targetId: row.targetId,
    organizationId: row.organizationId,
    success: row.success,
    meta: row.metaJson,
    createdAt: row.createdAt.toISOString(),
  };
}

export type AuditFilterInput = {
  action?: string;
  actorUserId?: string;
  targetType?: string;
  success?: boolean;
  from?: string;
  to?: string;
  q?: string;
};

export function matchesAuditFilter(
  event: {
    action: string;
    actorUserId: string | null;
    targetType: string | null;
    targetId: string | null;
    success: boolean;
    createdAt: string;
    meta?: unknown;
  },
  filters: AuditFilterInput,
): boolean {
  if (filters.action && event.action !== filters.action) return false;
  if (filters.actorUserId && event.actorUserId !== filters.actorUserId) return false;
  if (filters.targetType && event.targetType !== filters.targetType) return false;
  if (filters.success !== undefined && event.success !== filters.success) return false;
  if (filters.from && event.createdAt < filters.from) return false;
  if (filters.to && event.createdAt > filters.to) return false;
  if (filters.q) {
    const needle = filters.q.toLowerCase();
    const hay = [
      event.action,
      event.targetType ?? "",
      event.targetId ?? "",
      event.actorUserId ?? "",
      JSON.stringify(event.meta ?? {}),
    ]
      .join(" ")
      .toLowerCase();
    if (!hay.includes(needle)) return false;
  }
  return true;
}

export function filterAuditEvents<T extends Parameters<typeof matchesAuditFilter>[0]>(
  events: T[],
  filters: AuditFilterInput,
): T[] {
  return events.filter((event) => matchesAuditFilter(event, filters));
}
