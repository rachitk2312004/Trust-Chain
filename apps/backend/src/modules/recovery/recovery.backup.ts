import { createHash } from "node:crypto";
import { BackupFrequencies, RecoveryDefaults } from "@trustchain/config";

export type BackupPolicyEval = {
  id: string;
  frequency: string;
  rpoMinutes: number;
  rtoMinutes: number;
  retentionDays: number;
  regionCode: string;
  scopes: string[];
  enabled: boolean;
};

export function frequencyToMinutes(frequency: string): number {
  switch (frequency) {
    case BackupFrequencies.hourly:
      return 60;
    case BackupFrequencies.daily:
      return 24 * 60;
    case BackupFrequencies.weekly:
      return 7 * 24 * 60;
    case BackupFrequencies.monthly:
      return 30 * 24 * 60;
    default:
      return RecoveryDefaults.defaultRpoMinutes;
  }
}

/** Achieved RPO from last successful backup age (minutes). */
export function calculateAchievedRpoMinutes(
  lastBackupCompletedAt: Date | string | null,
  now = new Date(),
): number | null {
  if (!lastBackupCompletedAt) return null;
  const completed =
    typeof lastBackupCompletedAt === "string"
      ? new Date(lastBackupCompletedAt)
      : lastBackupCompletedAt;
  return Math.max(0, Math.round((now.getTime() - completed.getTime()) / 60_000));
}

export function isRpoWithinTarget(achievedMinutes: number | null, targetMinutes: number): boolean {
  if (achievedMinutes == null) return false;
  return achievedMinutes <= targetMinutes;
}

export function computeBackupExpiry(completedAt: Date, retentionDays: number): Date {
  const days = Math.max(1, retentionDays);
  return new Date(completedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function shouldScheduleBackup(input: {
  frequency: string;
  lastBackupCompletedAt: Date | string | null;
  now?: Date;
}): boolean {
  const now = input.now ?? new Date();
  if (!input.lastBackupCompletedAt) return true;
  const last =
    typeof input.lastBackupCompletedAt === "string"
      ? new Date(input.lastBackupCompletedAt)
      : input.lastBackupCompletedAt;
  const intervalMs = frequencyToMinutes(input.frequency) * 60_000;
  return now.getTime() - last.getTime() >= intervalMs;
}

export function buildBackupSnapshot(input: {
  organizationId: string;
  regionCode: string;
  scopes: string[];
  capturedAt: string;
}): { snapshot: Record<string, unknown>; checksumSha256: string; sizeBytes: number } {
  const snapshot = {
    organizationId: input.organizationId,
    regionCode: input.regionCode,
    scopes: [...input.scopes].sort(),
    capturedAt: input.capturedAt,
    version: 1,
  };
  const canonical = JSON.stringify(snapshot);
  return {
    snapshot,
    checksumSha256: createHash("sha256").update(canonical, "utf8").digest("hex"),
    sizeBytes: Buffer.byteLength(canonical, "utf8"),
  };
}

export function createBackupRecord(input: {
  organizationId: string;
  policy: BackupPolicyEval;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const built = buildBackupSnapshot({
    organizationId: input.organizationId,
    regionCode: input.policy.regionCode,
    scopes: input.policy.scopes,
    capturedAt: now.toISOString(),
  });
  return {
    ...built,
    regionCode: input.policy.regionCode,
    scopes: input.policy.scopes,
    expiresAt: computeBackupExpiry(now, input.policy.retentionDays),
    startedAt: now,
    completedAt: now,
  };
}
