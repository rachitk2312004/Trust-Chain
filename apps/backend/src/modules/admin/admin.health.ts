import { AdminHealthStatuses } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { AdminAuditActions } from "@trustchain/config";
import { writeAdminAudit } from "./admin.audit.js";

export type AdminHealthCheck = {
  name: string;
  status: (typeof AdminHealthStatuses)[keyof typeof AdminHealthStatuses];
  latencyMs: number | null;
  detail?: string;
};

export type AdminHealthReport = {
  status: (typeof AdminHealthStatuses)[keyof typeof AdminHealthStatuses];
  generatedAt: string;
  uptimeSeconds: number;
  checks: AdminHealthCheck[];
  process: {
    nodeVersion: string;
    pid: number;
    memoryRssBytes: number;
  };
};

export function aggregateHealthStatus(
  checks: Array<{ status: string }>,
): (typeof AdminHealthStatuses)[keyof typeof AdminHealthStatuses] {
  if (checks.some((c) => c.status === AdminHealthStatuses.down)) {
    return AdminHealthStatuses.down;
  }
  if (checks.some((c) => c.status === AdminHealthStatuses.degraded)) {
    return AdminHealthStatuses.degraded;
  }
  return AdminHealthStatuses.ok;
}

export function buildHealthReport(input: {
  checks: AdminHealthCheck[];
  uptimeSeconds: number;
  memoryRssBytes: number;
  nodeVersion: string;
  pid: number;
  generatedAt?: Date;
}): AdminHealthReport {
  return {
    status: aggregateHealthStatus(input.checks),
    generatedAt: (input.generatedAt ?? new Date()).toISOString(),
    uptimeSeconds: Math.max(0, Math.floor(input.uptimeSeconds)),
    checks: input.checks,
    process: {
      nodeVersion: input.nodeVersion,
      pid: input.pid,
      memoryRssBytes: input.memoryRssBytes,
    },
  };
}

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

async function checkDatabase(): Promise<AdminHealthCheck> {
  const started = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      name: "database",
      status: AdminHealthStatuses.ok,
      latencyMs: Date.now() - started,
      detail: "connected",
    };
  } catch (error) {
    return {
      name: "database",
      status: AdminHealthStatuses.down,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkAuditLogReadable(): Promise<AdminHealthCheck> {
  const started = Date.now();
  try {
    await prisma.adminAuditLog.count();
    return {
      name: "admin_audit",
      status: AdminHealthStatuses.ok,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      name: "admin_audit",
      status: AdminHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkConfigurationStore(): Promise<AdminHealthCheck> {
  const started = Date.now();
  try {
    await prisma.systemConfiguration.count();
    return {
      name: "configuration",
      status: AdminHealthStatuses.ok,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      name: "configuration",
      status: AdminHealthStatuses.degraded,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getAdminHealth(actorId: string, options?: { recordAudit?: boolean }) {
  await assertSuperAdmin(actorId);

  const checks = await Promise.all([
    checkDatabase(),
    checkAuditLogReadable(),
    checkConfigurationStore(),
  ]);

  const report = buildHealthReport({
    checks,
    uptimeSeconds: process.uptime(),
    memoryRssBytes: process.memoryUsage().rss,
    nodeVersion: process.version,
    pid: process.pid,
  });

  if (options?.recordAudit !== false) {
    await writeAdminAudit({
      actorUserId: actorId,
      action: AdminAuditActions.healthInspect,
      targetType: "system",
      targetId: null,
      meta: { status: report.status, checkCount: checks.length },
    });
  }

  return report;
}
