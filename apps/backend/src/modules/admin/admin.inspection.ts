import { AdminAuditActions, RoleKeys } from "@trustchain/config";
import { AppError } from "../../lib/errors.js";
import { userHasRole } from "../auth/rbac.repository.js";
import { toPublicAudit, writeAdminAudit } from "./admin.audit.js";
import * as repo from "./admin.repository.js";
import * as tenantRepo from "./admin.tenants.repository.js";
import {
  parseTenantQuotaLimits,
  quotaUtilization,
  emptyTenantQuotaUsage,
} from "./admin.tenants.workflow.js";

export type InspectionSectionStatus = "ok" | "warning" | "empty";

export type InspectionSection = {
  id: string;
  title: string;
  status: InspectionSectionStatus;
  summary: string;
  data: unknown;
};

export function classifyCount(total: number, warnBelow = 0): InspectionSectionStatus {
  if (total <= 0) return "empty";
  if (warnBelow > 0 && total < warnBelow) return "warning";
  return "ok";
}

export function buildInspectionSections(input: {
  tenants: { total: number; byStatus: Record<string, number>; sample: unknown[] };
  quotas: { tenantsWithQuota: number; overLimit: number; samples: unknown[] };
  features: { total: number; active: number; killed: number; sample: unknown[] };
  audit: { total: number; recent: unknown[] };
  configuration: { total: number; keys: string[] };
}): InspectionSection[] {
  return [
    {
      id: "tenants",
      title: "Tenants",
      status: classifyCount(input.tenants.total),
      summary: `${input.tenants.total} tenants`,
      data: input.tenants,
    },
    {
      id: "quotas",
      title: "Quotas",
      status: input.quotas.overLimit > 0 ? "warning" : classifyCount(input.quotas.tenantsWithQuota),
      summary:
        input.quotas.overLimit > 0
          ? `${input.quotas.overLimit} tenants over quota`
          : `${input.quotas.tenantsWithQuota} tenants with quotas`,
      data: input.quotas,
    },
    {
      id: "features",
      title: "Feature flags",
      status: input.features.killed > 0 ? "warning" : classifyCount(input.features.total),
      summary: `${input.features.active}/${input.features.total} active · ${input.features.killed} killed`,
      data: input.features,
    },
    {
      id: "audit",
      title: "Audit trail",
      status: classifyCount(input.audit.total),
      summary: `${input.audit.total} audit events`,
      data: input.audit,
    },
    {
      id: "configuration",
      title: "Configuration",
      status: classifyCount(input.configuration.total),
      summary: `${input.configuration.total} keys`,
      data: input.configuration,
    },
  ];
}

async function assertSuperAdmin(userId: string) {
  const ok = await userHasRole(userId, [RoleKeys.superAdmin]);
  if (!ok) throw new AppError(403, "FORBIDDEN", "Super admin role required");
}

export async function getAdminInspection(actorId: string) {
  await assertSuperAdmin(actorId);

  const [tenantList, featureFlags, audits, configurations, quotaRows] = await Promise.all([
    tenantRepo.listTenants({ limit: 20, offset: 0 }),
    repo.listFeatureFlags(),
    repo.listAuditLogs({ limit: 15, offset: 0 }),
    repo.listConfigurations(),
    // lightweight: reuse tenant list quotas when present
    Promise.resolve(null),
  ]);
  void quotaRows;

  const byStatus: Record<string, number> = {};
  for (const t of tenantList.items) {
    byStatus[t.status] = (byStatus[t.status] ?? 0) + 1;
  }

  const quotaSamples: Array<{
    organizationId: string;
    slug: string;
    overLimit: boolean;
    utilization: ReturnType<typeof quotaUtilization>;
  }> = [];
  let tenantsWithQuota = 0;
  let overLimit = 0;

  for (const t of tenantList.items) {
    if (!t.tenantQuota) continue;
    tenantsWithQuota += 1;
    const limits = parseTenantQuotaLimits(t.tenantQuota.limitsJson);
    const usage = t.tenantQuota.usageJson
      ? parseTenantQuotaLimits(t.tenantQuota.usageJson)
      : emptyTenantQuotaUsage();
    const utilization = quotaUtilization(limits, usage);
    const isOver = utilization.some(
      (row) => row.limit > 0 && row.percent != null && row.percent >= 100,
    );
    if (isOver) overLimit += 1;
    quotaSamples.push({
      organizationId: t.id,
      slug: t.slug,
      overLimit: isOver,
      utilization,
    });
  }

  const activeFeatures = featureFlags.filter((f) => f.status === "active").length;
  const killedFeatures = featureFlags.filter((f) => f.killSwitch).length;

  const sections = buildInspectionSections({
    tenants: {
      total: tenantList.total,
      byStatus,
      sample: tenantList.items.slice(0, 10).map((t) => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        counts: t._count,
      })),
    },
    quotas: {
      tenantsWithQuota,
      overLimit,
      samples: quotaSamples.slice(0, 10),
    },
    features: {
      total: featureFlags.length,
      active: activeFeatures,
      killed: killedFeatures,
      sample: featureFlags.slice(0, 10).map(repo.toPublicFeature),
    },
    audit: {
      total: audits.total,
      recent: audits.items.map(toPublicAudit),
    },
    configuration: {
      total: configurations.length,
      keys: configurations.map((c) => c.key),
    },
  });

  await writeAdminAudit({
    actorUserId: actorId,
    action: AdminAuditActions.systemInspect,
    targetType: "system",
    meta: {
      sectionCount: sections.length,
      tenants: tenantList.total,
      features: featureFlags.length,
    },
  });

  return {
    generatedAt: new Date().toISOString(),
    sections,
  };
}
