import {
  BackupJobStatuses,
  FailbackStatuses,
  RestoreJobStatuses,
} from "@trustchain/config";
import { prisma, type Prisma } from "@trustchain/database";
import { AppError } from "../../lib/errors.js";
import {
  calculateAchievedRpoMinutes,
  createBackupRecord,
  isRpoWithinTarget,
  shouldScheduleBackup,
  type BackupPolicyEval,
} from "./recovery.backup.js";
import {
  assertRestoreValid,
  buildFailbackPlan,
  calculateAchievedRtoMinutes,
  calculateContinuityScore,
  executeFailbackSteps,
  validateRestoreCandidate,
} from "./recovery.restore.js";

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toPublicPolicy(row: {
  id: string;
  organizationId: string;
  name: string;
  frequency: string;
  rpoMinutes: number;
  rtoMinutes: number;
  retentionDays: number;
  regionCode: string;
  scopesJson: Prisma.JsonValue;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    frequency: row.frequency,
    rpoMinutes: row.rpoMinutes,
    rtoMinutes: row.rtoMinutes,
    retentionDays: row.retentionDays,
    regionCode: row.regionCode,
    scopes: asStringArray(row.scopesJson),
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getRecoveryDashboard(organizationId: string) {
  const [policies, backups, restores, failbacks, latestReport] = await Promise.all([
    prisma.recoveryBackupPolicy.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.recoveryBackupJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.recoveryRestoreJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.recoveryFailbackJob.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.recoveryContinuityReport.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const primary = policies.find((p) => p.enabled) ?? policies[0] ?? null;
  const lastOk = backups.find((b) => b.status === BackupJobStatuses.completed) ?? null;
  const achievedRpo = calculateAchievedRpoMinutes(lastOk?.completedAt ?? null);

  return {
    organizationId,
    policies: policies.map(toPublicPolicy),
    recentBackups: backups.map((b) => ({
      id: b.id,
      status: b.status,
      regionCode: b.regionCode,
      checksumSha256: b.checksumSha256,
      sizeBytes: b.sizeBytes,
      scopes: asStringArray(b.scopesJson),
      completedAt: b.completedAt?.toISOString() ?? null,
      expiresAt: b.expiresAt?.toISOString() ?? null,
      createdAt: b.createdAt.toISOString(),
    })),
    recentRestores: restores.map((r) => ({
      id: r.id,
      status: r.status,
      backupJobId: r.backupJobId,
      targetRegionCode: r.targetRegionCode,
      completedAt: r.completedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    recentFailbacks: failbacks.map((f) => ({
      id: f.id,
      status: f.status,
      fromRegionCode: f.fromRegionCode,
      toRegionCode: f.toRegionCode,
      reason: f.reason,
      completedAt: f.completedAt?.toISOString() ?? null,
      createdAt: f.createdAt.toISOString(),
    })),
    objectives: primary
      ? {
          rpoMinutes: primary.rpoMinutes,
          rtoMinutes: primary.rtoMinutes,
          achievedRpoMinutes: achievedRpo,
          rpoMet: isRpoWithinTarget(achievedRpo, primary.rpoMinutes),
        }
      : null,
    latestScore: latestReport?.score ?? null,
  };
}

export async function createBackup(input: {
  organizationId: string;
  policy?: {
    name: string;
    frequency: string;
    rpoMinutes: number;
    rtoMinutes: number;
    retentionDays: number;
    regionCode: string;
    scopes?: string[];
    enabled?: boolean;
  };
  policyId?: string;
  triggeredById?: string | null;
}) {
  let policyRow =
    input.policyId != null
      ? await prisma.recoveryBackupPolicy.findFirst({
          where: { id: input.policyId, organizationId: input.organizationId },
        })
      : null;

  if (input.policy) {
    if (policyRow) {
      policyRow = await prisma.recoveryBackupPolicy.update({
        where: { id: policyRow.id },
        data: {
          name: input.policy.name,
          frequency: input.policy.frequency,
          rpoMinutes: input.policy.rpoMinutes,
          rtoMinutes: input.policy.rtoMinutes,
          retentionDays: input.policy.retentionDays,
          regionCode: input.policy.regionCode,
          scopesJson: input.policy.scopes ?? ["database", "documents"],
          enabled: input.policy.enabled ?? true,
        },
      });
    } else {
      policyRow = await prisma.recoveryBackupPolicy.create({
        data: {
          organizationId: input.organizationId,
          name: input.policy.name,
          frequency: input.policy.frequency,
          rpoMinutes: input.policy.rpoMinutes,
          rtoMinutes: input.policy.rtoMinutes,
          retentionDays: input.policy.retentionDays,
          regionCode: input.policy.regionCode,
          scopesJson: input.policy.scopes ?? ["database", "documents"],
          enabled: input.policy.enabled ?? true,
          createdById: input.triggeredById ?? null,
        },
      });
    }
  }

  if (!policyRow) {
    policyRow = await prisma.recoveryBackupPolicy.findFirst({
      where: { organizationId: input.organizationId, enabled: true },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!policyRow) {
    throw new AppError(400, "POLICY_MISSING", "Backup policy required");
  }

  const lastOk = await prisma.recoveryBackupJob.findFirst({
    where: {
      organizationId: input.organizationId,
      policyId: policyRow.id,
      status: BackupJobStatuses.completed,
    },
    orderBy: { completedAt: "desc" },
  });

  const policyEval: BackupPolicyEval = {
    id: policyRow.id,
    frequency: policyRow.frequency,
    rpoMinutes: policyRow.rpoMinutes,
    rtoMinutes: policyRow.rtoMinutes,
    retentionDays: policyRow.retentionDays,
    regionCode: policyRow.regionCode,
    scopes: asStringArray(policyRow.scopesJson),
    enabled: policyRow.enabled,
  };

  const scheduled = shouldScheduleBackup({
    frequency: policyEval.frequency,
    lastBackupCompletedAt: lastOk?.completedAt ?? null,
  });

  const built = createBackupRecord({
    organizationId: input.organizationId,
    policy: policyEval,
  });

  const job = await prisma.recoveryBackupJob.create({
    data: {
      organizationId: input.organizationId,
      policyId: policyRow.id,
      status: BackupJobStatuses.completed,
      regionCode: built.regionCode,
      checksumSha256: built.checksumSha256,
      sizeBytes: built.sizeBytes,
      scopesJson: built.scopes,
      snapshotJson: built.snapshot as unknown as Prisma.InputJsonValue,
      startedAt: built.startedAt,
      completedAt: built.completedAt,
      expiresAt: built.expiresAt,
      triggeredById: input.triggeredById ?? null,
    },
  });

  // Expire old backups past retention
  await prisma.recoveryBackupJob.updateMany({
    where: {
      organizationId: input.organizationId,
      status: BackupJobStatuses.completed,
      expiresAt: { lte: new Date() },
    },
    data: { status: BackupJobStatuses.expired },
  });

  return {
    policy: toPublicPolicy(policyRow),
    backup: {
      id: job.id,
      status: job.status,
      regionCode: job.regionCode,
      checksumSha256: job.checksumSha256,
      sizeBytes: job.sizeBytes,
      scopes: asStringArray(job.scopesJson),
      completedAt: job.completedAt?.toISOString() ?? null,
      expiresAt: job.expiresAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
    },
    scheduledDue: scheduled,
  };
}

export async function createRestore(input: {
  organizationId: string;
  backupJobId: string;
  targetRegionCode: string;
  triggeredById?: string | null;
}) {
  const backup = await prisma.recoveryBackupJob.findFirst({
    where: { id: input.backupJobId, organizationId: input.organizationId },
    include: { policy: true },
  });
  if (!backup) throw new AppError(404, "NOT_FOUND", "Backup not found");

  const rtoTarget = backup.policy?.rtoMinutes ?? 240;
  const validation = validateRestoreCandidate({
    backup: {
      id: backup.id,
      status: backup.status,
      checksumSha256: backup.checksumSha256,
      sizeBytes: backup.sizeBytes,
      regionCode: backup.regionCode,
      expiresAt: backup.expiresAt,
      scopes: asStringArray(backup.scopesJson),
    },
    targetRegionCode: input.targetRegionCode,
    rtoMinutesTarget: rtoTarget,
  });
  assertRestoreValid(validation);

  const startedAt = new Date();
  const completedAt = new Date(startedAt.getTime() + validation.estimatedRtoMinutes * 60_000);

  const job = await prisma.recoveryRestoreJob.create({
    data: {
      organizationId: input.organizationId,
      backupJobId: backup.id,
      status: RestoreJobStatuses.completed,
      targetRegionCode: input.targetRegionCode,
      validationJson: validation as unknown as Prisma.InputJsonValue,
      startedAt,
      completedAt,
      triggeredById: input.triggeredById ?? null,
    },
  });

  return {
    restore: {
      id: job.id,
      status: job.status,
      backupJobId: job.backupJobId,
      targetRegionCode: job.targetRegionCode,
      validation,
      achievedRtoMinutes: calculateAchievedRtoMinutes({
        restoreStartedAt: startedAt,
        restoreCompletedAt: completedAt,
      }),
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      createdAt: job.createdAt.toISOString(),
    },
  };
}

export async function createFailback(input: {
  organizationId: string;
  fromRegionCode: string;
  toRegionCode: string;
  reason: string;
  triggeredById?: string | null;
}) {
  const plan = buildFailbackPlan({
    fromRegionCode: input.fromRegionCode,
    toRegionCode: input.toRegionCode,
  });
  const executed = executeFailbackSteps(plan);
  const startedAt = new Date();
  const completedAt = new Date();

  const job = await prisma.recoveryFailbackJob.create({
    data: {
      organizationId: input.organizationId,
      fromRegionCode: input.fromRegionCode,
      toRegionCode: input.toRegionCode,
      reason: input.reason,
      status: FailbackStatuses.completed,
      stepsJson: executed.steps as unknown as Prisma.InputJsonValue,
      startedAt,
      completedAt,
      triggeredById: input.triggeredById ?? null,
    },
  });

  // Align residency/failover primary if policies exist
  const failover = await prisma.orgFailoverPolicy.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (failover) {
    await prisma.orgFailoverPolicy.update({
      where: { organizationId: input.organizationId },
      data: {
        primaryRegionCode: input.toRegionCode,
        standbyRegionsJson: [
          input.fromRegionCode,
          ...asStringArray(failover.standbyRegionsJson).filter(
            (c) => c !== input.toRegionCode && c !== input.fromRegionCode,
          ),
        ],
      },
    });
  }
  const residency = await prisma.orgResidencyPolicy.findUnique({
    where: { organizationId: input.organizationId },
  });
  if (residency) {
    await prisma.orgResidencyPolicy.update({
      where: { organizationId: input.organizationId },
      data: { homeRegionCode: input.toRegionCode },
    });
  }

  return {
    failback: {
      id: job.id,
      status: job.status,
      fromRegionCode: job.fromRegionCode,
      toRegionCode: job.toRegionCode,
      reason: job.reason,
      steps: executed.steps,
      completed: executed.completed,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      createdAt: job.createdAt.toISOString(),
    },
  };
}

export async function getRecoveryStatus(organizationId: string) {
  const dash = await getRecoveryDashboard(organizationId);
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [okCount, failCount, failbackCount] = await Promise.all([
    prisma.recoveryBackupJob.count({
      where: {
        organizationId,
        status: BackupJobStatuses.completed,
        createdAt: { gte: since },
      },
    }),
    prisma.recoveryBackupJob.count({
      where: {
        organizationId,
        status: BackupJobStatuses.failed,
        createdAt: { gte: since },
      },
    }),
    prisma.recoveryFailbackJob.count({
      where: { organizationId, status: FailbackStatuses.completed },
    }),
  ]);

  const continuity = calculateContinuityScore({
    rpoMet: dash.objectives?.rpoMet ?? false,
    rtoMet: true,
    successfulBackupsLast7d: okCount,
    failedBackupsLast7d: failCount,
    hasFailbackPlan: failbackCount > 0 || Boolean(dash.objectives),
  });

  return {
    organizationId,
    objectives: dash.objectives,
    continuity,
    counts: {
      policies: dash.policies.length,
      backups: dash.recentBackups.length,
      restores: dash.recentRestores.length,
      failbacks: dash.recentFailbacks.length,
    },
    latestBackup: dash.recentBackups[0] ?? null,
  };
}

export async function listRecoveryReports(query: {
  organizationId: string;
  limit: number;
  offset: number;
}) {
  // Generate a fresh report snapshot on list for foundation continuity reporting
  const status = await getRecoveryStatus(query.organizationId);
  const created = await prisma.recoveryContinuityReport.create({
    data: {
      organizationId: query.organizationId,
      score: status.continuity.score,
      summaryJson: {
        objectives: status.objectives,
        continuity: status.continuity,
        counts: status.counts,
        generatedAt: new Date().toISOString(),
      } as unknown as Prisma.InputJsonValue,
    },
  });

  const [rows, total] = await Promise.all([
    prisma.recoveryContinuityReport.findMany({
      where: { organizationId: query.organizationId },
      orderBy: { createdAt: "desc" },
      take: query.limit,
      skip: query.offset,
    }),
    prisma.recoveryContinuityReport.count({
      where: { organizationId: query.organizationId },
    }),
  ]);

  return {
    reports: rows.map((r) => ({
      id: r.id,
      score: r.score,
      summary: r.summaryJson,
      createdAt: r.createdAt.toISOString(),
    })),
    latest: {
      id: created.id,
      score: created.score,
      summary: created.summaryJson,
      createdAt: created.createdAt.toISOString(),
    },
    total,
    limit: query.limit,
    offset: query.offset,
  };
}
