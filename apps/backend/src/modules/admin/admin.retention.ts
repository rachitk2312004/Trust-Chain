import {
  AdminAuditActions,
  AdminDiagnosticAuditActions,
  AdminRetentionDefaults,
} from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { adminProcessMetrics } from "./admin.observability.js";

export type AdminRetentionPolicy = {
  auditDays: number;
  policyEventDays: number;
  lifecycleEventDays: number;
  configurationAuditDays: number;
  diagnosticDays: number;
};

export const DEFAULT_ADMIN_RETENTION_POLICY: AdminRetentionPolicy = {
  auditDays:
    Number.parseInt(process.env.ADMIN_AUDIT_RETENTION_DAYS ?? "", 10) ||
    AdminRetentionDefaults.auditDays,
  policyEventDays:
    Number.parseInt(process.env.ADMIN_POLICY_EVENT_RETENTION_DAYS ?? "", 10) ||
    AdminRetentionDefaults.policyEventDays,
  lifecycleEventDays:
    Number.parseInt(process.env.ADMIN_LIFECYCLE_EVENT_RETENTION_DAYS ?? "", 10) ||
    AdminRetentionDefaults.lifecycleEventDays,
  configurationAuditDays:
    Number.parseInt(process.env.ADMIN_CONFIGURATION_AUDIT_RETENTION_DAYS ?? "", 10) ||
    AdminRetentionDefaults.configurationAuditDays,
  diagnosticDays:
    Number.parseInt(process.env.ADMIN_DIAGNOSTIC_RETENTION_DAYS ?? "", 10) ||
    AdminRetentionDefaults.diagnosticDays,
};

export type AdminRetentionResult = {
  deletedAudit: number;
  deletedPolicyEvents: number;
  deletedLifecycleEvents: number;
  deletedConfigurationAudits: number;
  deletedDiagnostics: number;
  cutoffs: {
    audit: string;
    policyEvents: string;
    lifecycleEvents: string;
    configurationAudits: string;
    diagnostics: string;
  };
  policy: AdminRetentionPolicy;
  dryRun: boolean;
};

export function retentionCutoff(days: number, now = new Date()): Date {
  const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

export function mergeRetentionPolicy(
  overrides?: Partial<AdminRetentionPolicy> | null,
): AdminRetentionPolicy {
  return {
    auditDays: overrides?.auditDays ?? DEFAULT_ADMIN_RETENTION_POLICY.auditDays,
    policyEventDays: overrides?.policyEventDays ?? DEFAULT_ADMIN_RETENTION_POLICY.policyEventDays,
    lifecycleEventDays:
      overrides?.lifecycleEventDays ?? DEFAULT_ADMIN_RETENTION_POLICY.lifecycleEventDays,
    configurationAuditDays:
      overrides?.configurationAuditDays ?? DEFAULT_ADMIN_RETENTION_POLICY.configurationAuditDays,
    diagnosticDays: overrides?.diagnosticDays ?? DEFAULT_ADMIN_RETENTION_POLICY.diagnosticDays,
  };
}

const CONFIG_AUDIT_ACTIONS = [
  AdminAuditActions.configurationUpdate,
  AdminAuditActions.configurationRollback,
];

const DIAGNOSTIC_ACTIONS = [...AdminDiagnosticAuditActions];

export function buildRetentionCutoffs(policy: AdminRetentionPolicy, now = new Date()) {
  return {
    audit: retentionCutoff(policy.auditDays, now),
    policyEvents: retentionCutoff(policy.policyEventDays, now),
    lifecycleEvents: retentionCutoff(policy.lifecycleEventDays, now),
    configurationAudits: retentionCutoff(policy.configurationAuditDays, now),
    diagnostics: retentionCutoff(policy.diagnosticDays, now),
  };
}

export async function previewAdminRetention(
  policy: AdminRetentionPolicy = DEFAULT_ADMIN_RETENTION_POLICY,
  now = new Date(),
) {
  const cutoffs = buildRetentionCutoffs(policy, now);
  const [
    auditEligible,
    policyEventsEligible,
    lifecycleEligible,
    configurationEligible,
    diagnosticEligible,
  ] = await Promise.all([
    prisma.adminAuditLog.count({
      where: {
        createdAt: { lte: cutoffs.audit },
        action: { notIn: [...CONFIG_AUDIT_ACTIONS, ...DIAGNOSTIC_ACTIONS] },
      },
    }),
    prisma.policyEvaluationEvent.count({
      where: { createdAt: { lte: cutoffs.policyEvents } },
    }),
    prisma.tenantLifecycleEvent.count({
      where: { createdAt: { lte: cutoffs.lifecycleEvents } },
    }),
    prisma.adminAuditLog.count({
      where: {
        createdAt: { lte: cutoffs.configurationAudits },
        action: { in: [...CONFIG_AUDIT_ACTIONS] },
      },
    }),
    prisma.adminAuditLog.count({
      where: {
        createdAt: { lte: cutoffs.diagnostics },
        action: { in: [...DIAGNOSTIC_ACTIONS] },
      },
    }),
  ]);

  return {
    auditEligible,
    policyEventsEligible,
    lifecycleEventsEligible: lifecycleEligible,
    configurationAuditsEligible: configurationEligible,
    diagnosticsEligible: diagnosticEligible,
    policy,
    cutoffs: {
      audit: cutoffs.audit.toISOString(),
      policyEvents: cutoffs.policyEvents.toISOString(),
      lifecycleEvents: cutoffs.lifecycleEvents.toISOString(),
      configurationAudits: cutoffs.configurationAudits.toISOString(),
      diagnostics: cutoffs.diagnostics.toISOString(),
    },
  };
}

/**
 * Purges aged admin audit, policy evaluation, lifecycle, configuration-audit,
 * and diagnostic rows. Does not delete SystemConfiguration or PolicyDefinition.
 */
export async function runAdminRetentionCleanup(
  policy: AdminRetentionPolicy = DEFAULT_ADMIN_RETENTION_POLICY,
  options?: { dryRun?: boolean; now?: Date },
): Promise<AdminRetentionResult> {
  const now = options?.now ?? new Date();
  const dryRun = options?.dryRun === true;
  const cutoffs = buildRetentionCutoffs(policy, now);

  if (dryRun) {
    const preview = await previewAdminRetention(policy, now);
    return {
      deletedAudit: preview.auditEligible,
      deletedPolicyEvents: preview.policyEventsEligible,
      deletedLifecycleEvents: preview.lifecycleEventsEligible,
      deletedConfigurationAudits: preview.configurationAuditsEligible,
      deletedDiagnostics: preview.diagnosticsEligible,
      cutoffs: preview.cutoffs,
      policy,
      dryRun: true,
    };
  }

  const deletedDiagnostics = await prisma.adminAuditLog.deleteMany({
    where: {
      createdAt: { lte: cutoffs.diagnostics },
      action: { in: [...DIAGNOSTIC_ACTIONS] },
    },
  });

  const deletedConfigurationAudits = await prisma.adminAuditLog.deleteMany({
    where: {
      createdAt: { lte: cutoffs.configurationAudits },
      action: { in: [...CONFIG_AUDIT_ACTIONS] },
    },
  });

  const deletedAudit = await prisma.adminAuditLog.deleteMany({
    where: {
      createdAt: { lte: cutoffs.audit },
      action: { notIn: [...CONFIG_AUDIT_ACTIONS, ...DIAGNOSTIC_ACTIONS] },
    },
  });

  const deletedPolicyEvents = await prisma.policyEvaluationEvent.deleteMany({
    where: { createdAt: { lte: cutoffs.policyEvents } },
  });

  const deletedLifecycleEvents = await prisma.tenantLifecycleEvent.deleteMany({
    where: { createdAt: { lte: cutoffs.lifecycleEvents } },
  });

  adminProcessMetrics.recordRetention();

  return {
    deletedAudit: deletedAudit.count,
    deletedPolicyEvents: deletedPolicyEvents.count,
    deletedLifecycleEvents: deletedLifecycleEvents.count,
    deletedConfigurationAudits: deletedConfigurationAudits.count,
    deletedDiagnostics: deletedDiagnostics.count,
    cutoffs: {
      audit: cutoffs.audit.toISOString(),
      policyEvents: cutoffs.policyEvents.toISOString(),
      lifecycleEvents: cutoffs.lifecycleEvents.toISOString(),
      configurationAudits: cutoffs.configurationAudits.toISOString(),
      diagnostics: cutoffs.diagnostics.toISOString(),
    },
    policy,
    dryRun: false,
  };
}
