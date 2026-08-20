import { z } from "zod";
import {
  FailoverModeList,
  RegionDefaults,
  RegionStatusList,
  ReplicationModeList,
  ResidencyModeList,
  RoutingStrategyList,
} from "@trustchain/config";

export const listRegionsQuerySchema = z.object({
  status: z.enum(RegionStatusList as [string, ...string[]]).optional(),
  organizationId: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(RegionDefaults.maxLimit)
    .default(RegionDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createRegionBodySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().trim().min(2).max(200),
  jurisdiction: z.string().trim().min(2).max(64),
  endpointUrl: z.string().url().max(1000),
  status: z.enum(RegionStatusList as [string, ...string[]]).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  latencyWeight: z.number().int().min(1).max(10_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  /// Optional: seed org residency/routing/replication/failover when provided
  organizationId: z.string().uuid().optional(),
  residency: z
    .object({
      mode: z.enum(ResidencyModeList as [string, ...string[]]).optional(),
      allowedRegions: z.array(z.string().trim().min(2).max(32)).max(RegionDefaults.maxAllowedRegions).optional(),
      lockedClasses: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
    })
    .optional(),
});

export const patchRegionBodySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  jurisdiction: z.string().trim().min(2).max(64).optional(),
  endpointUrl: z.string().url().max(1000).optional(),
  status: z.enum(RegionStatusList as [string, ...string[]]).optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  latencyWeight: z.number().int().min(1).max(10_000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const regionIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const routingQuerySchema = z.object({
  organizationId: z.string().uuid(),
  clientRegionHint: z.string().trim().min(2).max(32).optional(),
  stickyRegion: z.string().trim().min(2).max(32).optional(),
  dataClass: z.string().trim().min(1).max(64).optional(),
});

export const failoverBodySchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().trim().min(2).max(500),
  force: z.boolean().optional().default(false),
  consecutivePrimaryFailures: z.number().int().min(0).max(100).optional().default(0),
  /// Optional policy upsert before failover
  failoverPolicy: z
    .object({
      mode: z.enum(FailoverModeList as [string, ...string[]]).optional(),
      primaryRegionCode: z.string().trim().min(2).max(32).optional(),
      standbyRegions: z.array(z.string().trim().min(2).max(32)).max(RegionDefaults.maxAllowedRegions).optional(),
      healthFailThreshold: z.number().int().min(1).max(20).optional(),
    })
    .optional(),
});

export const residencyQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const upsertOrgPoliciesBodySchema = z.object({
  organizationId: z.string().uuid(),
  homeRegionCode: z.string().trim().min(2).max(32).optional(),
  residencyMode: z.enum(ResidencyModeList as [string, ...string[]]).optional(),
  allowedRegions: z.array(z.string().trim().min(2).max(32)).max(RegionDefaults.maxAllowedRegions).optional(),
  lockedClasses: z.array(z.string().trim().min(1).max(64)).max(20).optional(),
  routingStrategy: z.enum(RoutingStrategyList as [string, ...string[]]).optional(),
  replicationMode: z.enum(ReplicationModeList as [string, ...string[]]).optional(),
  replicationTargets: z.array(z.string().trim().min(2).max(32)).max(RegionDefaults.maxAllowedRegions).optional(),
});
