import { z } from "zod";
import {
  BackupFrequencyList,
  RecoveryDefaults,
} from "@trustchain/config";

export const recoveryOrgQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const createBackupBodySchema = z.object({
  organizationId: z.string().uuid(),
  // Create/update policy then run backup
  policy: z
    .object({
      name: z.string().trim().min(2).max(200),
      frequency: z.enum(BackupFrequencyList as [string, ...string[]]),
      rpoMinutes: z
        .number()
        .int()
        .min(RecoveryDefaults.minRpoMinutes)
        .max(RecoveryDefaults.maxRpoMinutes)
        .default(RecoveryDefaults.defaultRpoMinutes),
      rtoMinutes: z
        .number()
        .int()
        .min(RecoveryDefaults.minRtoMinutes)
        .max(RecoveryDefaults.maxRtoMinutes)
        .default(RecoveryDefaults.defaultRtoMinutes),
      retentionDays: z.number().int().min(1).max(3650).default(RecoveryDefaults.defaultRetentionDays),
      regionCode: z.string().trim().min(2).max(32),
      scopes: z.array(z.string().trim().min(1).max(64)).min(1).max(20).optional(),
      enabled: z.boolean().optional(),
    })
    .optional(),
  policyId: z.string().uuid().optional(),
});

export const createRestoreBodySchema = z.object({
  organizationId: z.string().uuid(),
  backupJobId: z.string().uuid(),
  targetRegionCode: z.string().trim().min(2).max(32),
});

export const createFailbackBodySchema = z.object({
  organizationId: z.string().uuid(),
  fromRegionCode: z.string().trim().min(2).max(32),
  toRegionCode: z.string().trim().min(2).max(32),
  reason: z.string().trim().min(2).max(500),
});

export const recoveryStatusQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const recoveryReportsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RecoveryDefaults.maxLimit)
    .default(RecoveryDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});
