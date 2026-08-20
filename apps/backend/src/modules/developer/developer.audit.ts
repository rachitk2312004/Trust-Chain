import { prisma, type Prisma } from "@trustchain/database";
import { toPublicAudit, type AuditFilterInput, matchesAuditFilter } from "../admin/admin.audit.js";

const DEVELOPER_ACTION_PREFIX = "developer.";

export type DeveloperAuditQuery = AuditFilterInput & {
  organizationId: string;
  limit?: number;
  offset?: number;
};

export function isDeveloperAuditAction(action: string): boolean {
  return action.startsWith(DEVELOPER_ACTION_PREFIX);
}

export function filterDeveloperAuditEvents<
  T extends {
    action: string;
    actorUserId: string | null;
    targetType: string | null;
    targetId: string | null;
    success: boolean;
    createdAt: string;
    meta?: unknown;
  },
>(events: T[], filters: AuditFilterInput): T[] {
  return events.filter(
    (event) => isDeveloperAuditAction(event.action) && matchesAuditFilter(event, filters),
  );
}

export async function searchDeveloperAudit(input: DeveloperAuditQuery) {
  if (input.action && !input.action.startsWith(DEVELOPER_ACTION_PREFIX)) {
    return { events: [], total: 0, limit: input.limit ?? 50, offset: input.offset ?? 0 };
  }

  const where: Prisma.AdminAuditLogWhereInput = {
    organizationId: input.organizationId,
    action: input.action ?? { startsWith: DEVELOPER_ACTION_PREFIX },
  };
  if (input.actorUserId) where.actorUserId = input.actorUserId;
  if (input.targetType) where.targetType = input.targetType;
  if (input.success !== undefined) where.success = input.success;
  if (input.from || input.to) {
    where.createdAt = {
      ...(input.from ? { gte: new Date(input.from) } : {}),
      ...(input.to ? { lte: new Date(input.to) } : {}),
    };
  }

  const take = input.limit ?? 50;
  const skip = input.offset ?? 0;

  const [rows, total] = await Promise.all([
    prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(200, take * 3),
      skip,
    }),
    prisma.adminAuditLog.count({ where }),
  ]);

  let events = rows.map(toPublicAudit);
  if (input.q) {
    events = filterDeveloperAuditEvents(events, { q: input.q });
  }

  return {
    events: events.slice(0, take),
    total: input.q ? events.length : total,
    limit: take,
    offset: skip,
  };
}
