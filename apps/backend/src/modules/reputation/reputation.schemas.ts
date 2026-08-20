import { z } from "zod";
import {
  ReputationAlertStatusList,
  ReputationDefaults,
  ReputationProfileStatusList,
  ReputationSubjectTypeList,
} from "@trustchain/config";

const signalsSchema = z.object({
  verificationRate: z.number().min(0).max(1).optional(),
  activityVolume: z.number().min(0).max(1).optional(),
  peerRating: z.number().min(0).max(1).optional(),
  longevity: z.number().min(0).max(1).optional(),
  incidentRate: z.number().min(0).max(1).optional(),
  manualAdjustment: z.number().min(-1).max(1).optional(),
});

const fraudSignalsSchema = z.object({
  scoreVelocity: z.number().min(0).max(1).optional(),
  identityCollisions: z.number().int().min(0).max(100).optional(),
  failedVerificationBurst: z.number().min(0).max(1).optional(),
  burstActivity: z.number().min(0).max(1).optional(),
  denylistHit: z.number().min(0).max(1).optional(),
});

export const reputationQuerySchema = z.object({
  organizationId: z.string().uuid(),
  subjectType: z.enum(ReputationSubjectTypeList as [string, ...string[]]).optional(),
  status: z.enum(ReputationProfileStatusList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ReputationDefaults.maxLimit)
    .default(ReputationDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const scoreBodySchema = z.object({
  organizationId: z.string().uuid(),
  subjectType: z.enum(ReputationSubjectTypeList as [string, ...string[]]),
  subjectId: z.string().trim().min(1).max(128),
  label: z.string().trim().min(1).max(200).optional(),
  signals: signalsSchema.optional(),
  fraudSignals: fraudSignalsSchema.optional(),
  reason: z.string().trim().min(2).max(200).optional(),
});

export const patchReputationBodySchema = z.object({
  label: z.string().trim().min(1).max(200).optional().nullable(),
  status: z.enum(ReputationProfileStatusList as [string, ...string[]]).optional(),
  manualAdjustment: z.number().min(-1).max(1).optional(),
  reason: z.string().trim().min(2).max(200).optional(),
});

export const reputationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const historyQuerySchema = z.object({
  organizationId: z.string().uuid(),
  profileId: z.string().uuid().optional(),
  subjectType: z.enum(ReputationSubjectTypeList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ReputationDefaults.maxLimit)
    .default(ReputationDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const alertsQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(ReputationAlertStatusList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(ReputationDefaults.maxLimit)
    .default(ReputationDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const leaderboardQuerySchema = z.object({
  organizationId: z.string().uuid(),
  subjectType: z.enum(ReputationSubjectTypeList as [string, ...string[]]).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .default(ReputationDefaults.leaderboardLimit),
});
