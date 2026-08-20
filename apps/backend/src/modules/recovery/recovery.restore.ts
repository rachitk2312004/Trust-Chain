import { AppError } from "../../lib/errors.js";

export type BackupArtifact = {
  id: string;
  status: string;
  checksumSha256: string | null;
  sizeBytes: number;
  regionCode: string;
  expiresAt: Date | string | null;
  scopes: string[];
};

export type RestoreValidation = {
  valid: boolean;
  reasons: string[];
  estimatedRtoMinutes: number;
};

export function validateRestoreCandidate(input: {
  backup: BackupArtifact;
  targetRegionCode: string;
  allowedRegions?: string[];
  rtoMinutesTarget: number;
  now?: Date;
}): RestoreValidation {
  const reasons: string[] = [];
  const now = input.now ?? new Date();

  if (input.backup.status !== "completed") {
    reasons.push("backup_not_completed");
  }
  if (!input.backup.checksumSha256 || input.backup.checksumSha256.length !== 64) {
    reasons.push("checksum_missing");
  }
  if (input.backup.sizeBytes <= 0) {
    reasons.push("empty_backup");
  }
  if (input.backup.expiresAt) {
    const exp =
      typeof input.backup.expiresAt === "string"
        ? new Date(input.backup.expiresAt)
        : input.backup.expiresAt;
    if (exp.getTime() <= now.getTime()) reasons.push("backup_expired");
  }
  if (
    input.allowedRegions?.length &&
    !input.allowedRegions.includes(input.targetRegionCode)
  ) {
    reasons.push("target_region_not_allowed");
  }

  // Foundation RTO estimate: base 15m + 1m per 10KB snapshot
  const estimatedRtoMinutes = Math.max(
    15,
    15 + Math.ceil(input.backup.sizeBytes / 10_240),
  );
  if (estimatedRtoMinutes > input.rtoMinutesTarget) {
    reasons.push("rto_target_exceeded");
  }

  return {
    valid: reasons.length === 0,
    reasons,
    estimatedRtoMinutes,
  };
}

export function assertRestoreValid(validation: RestoreValidation): void {
  if (!validation.valid) {
    throw new AppError(
      400,
      "RESTORE_VALIDATION_FAILED",
      `Restore validation failed: ${validation.reasons.join(", ")}`,
    );
  }
}

export type FailbackStep = {
  order: number;
  name: string;
  status: "pending" | "completed" | "failed";
};

export function buildFailbackPlan(input: {
  fromRegionCode: string;
  toRegionCode: string;
}): FailbackStep[] {
  if (input.fromRegionCode === input.toRegionCode) {
    throw new AppError(400, "VALIDATION_ERROR", "Failback source and target must differ");
  }
  return [
    { order: 1, name: "validate_standby_health", status: "pending" },
    { order: 2, name: "quiesce_writes_on_failover_region", status: "pending" },
    { order: 3, name: "replicate_delta_to_primary", status: "pending" },
    { order: 4, name: "cutover_traffic", status: "pending" },
    { order: 5, name: "verify_continuity", status: "pending" },
  ];
}

export function executeFailbackSteps(steps: FailbackStep[]): {
  steps: FailbackStep[];
  completed: boolean;
} {
  const next = steps.map((s) => ({ ...s, status: "completed" as const }));
  return { steps: next, completed: true };
}

/** Continuity score 0..1 from RPO/RTO adherence and backup freshness. */
export function calculateContinuityScore(input: {
  rpoMet: boolean;
  rtoMet: boolean;
  successfulBackupsLast7d: number;
  failedBackupsLast7d: number;
  hasFailbackPlan: boolean;
}): { score: number; factors: Record<string, number> } {
  const backupTotal = input.successfulBackupsLast7d + input.failedBackupsLast7d;
  const backupSuccessRate =
    backupTotal === 0 ? 0.5 : input.successfulBackupsLast7d / backupTotal;

  const factors = {
    rpo: input.rpoMet ? 1 : 0,
    rto: input.rtoMet ? 1 : 0,
    backupSuccessRate,
    failbackReadiness: input.hasFailbackPlan ? 1 : 0.4,
  };

  const score = Number(
    (
      factors.rpo * 0.35 +
      factors.rto * 0.25 +
      factors.backupSuccessRate * 0.25 +
      factors.failbackReadiness * 0.15
    ).toFixed(3),
  );

  return { score, factors };
}

export function calculateAchievedRtoMinutes(input: {
  restoreStartedAt: Date | string;
  restoreCompletedAt: Date | string;
}): number {
  const start =
    typeof input.restoreStartedAt === "string"
      ? new Date(input.restoreStartedAt)
      : input.restoreStartedAt;
  const end =
    typeof input.restoreCompletedAt === "string"
      ? new Date(input.restoreCompletedAt)
      : input.restoreCompletedAt;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));
}
