import { z } from "zod";
import {
  FeatureFlagStatuses,
  PlatformConfigKeyList,
  PlatformDefaults,
} from "@trustchain/config";

export const platformFeaturesQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PlatformDefaults.maxLimit)
    .default(PlatformDefaults.defaultLimit),
});

export const patchFeatureBodySchema = z.object({
  status: z
    .enum([
      FeatureFlagStatuses.active,
      FeatureFlagStatuses.inactive,
      FeatureFlagStatuses.suspended,
    ] as [string, ...string[]])
    .optional(),
  rolloutPercent: z.number().int().min(0).max(100).optional(),
  killSwitch: z.boolean().optional(),
  targeting: z.record(z.unknown()).optional().nullable(),
  experiments: z.record(z.unknown()).optional().nullable(),
});

export const featureIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const patchConfigurationBodySchema = z.object({
  entries: z
    .array(
      z.object({
        key: z.enum(PlatformConfigKeyList as [string, ...string[]]),
        value: z.record(z.unknown()),
        description: z.string().trim().min(1).max(500).optional().nullable(),
      }),
    )
    .min(1)
    .max(20),
});

export const metricsQuerySchema = z.object({
  persist: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});
