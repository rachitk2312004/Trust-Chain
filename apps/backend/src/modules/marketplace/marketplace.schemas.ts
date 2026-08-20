import { z } from "zod";
import {
  IntegrationAuthModeList,
  IntegrationCategoryList,
  IntegrationConnectorKeyList,
  MarketplaceDefaults,
  MarketplaceListingStatusList,
} from "@trustchain/config";

export const marketplaceQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  category: z.enum(IntegrationCategoryList as [string, ...string[]]).optional(),
  status: z.enum(MarketplaceListingStatusList as [string, ...string[]]).optional(),
  publisherOrgId: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MarketplaceDefaults.maxLimit)
    .default(MarketplaceDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createConnectorBodySchema = z.object({
  publisherOrgId: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug")
    .optional(),
  summary: z.string().trim().min(4).max(280),
  description: z.string().trim().max(4000).optional(),
  category: z.enum(IntegrationCategoryList as [string, ...string[]]),
  connectorKey: z.enum(IntegrationConnectorKeyList as [string, ...string[]]).optional().nullable(),
  authMode: z.enum(IntegrationAuthModeList as [string, ...string[]]),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(\.\d+)?$/, "Version must be semver"),
  changelog: z.string().trim().max(2000).optional(),
  minPlatformVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .default("1.0.0"),
  maxPlatformVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .optional()
    .nullable(),
  publish: z.boolean().optional(),
});

export const patchConnectorBodySchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  summary: z.string().trim().min(4).max(280).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z.enum(MarketplaceListingStatusList as [string, ...string[]]).optional(),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .optional(),
  changelog: z.string().trim().max(2000).optional(),
  minPlatformVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .optional(),
  maxPlatformVersion: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .optional()
    .nullable(),
  publishVersion: z.boolean().optional(),
});

export const connectorIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const reviewsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  listingId: z.string().uuid().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MarketplaceDefaults.maxLimit)
    .default(MarketplaceDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createReviewBodySchema = z.object({
  organizationId: z.string().uuid(),
  listingId: z.string().uuid(),
  rating: z
    .number()
    .int()
    .min(MarketplaceDefaults.minRating)
    .max(MarketplaceDefaults.maxRating),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().max(2000).optional(),
});

export const installBodySchema = z.object({
  organizationId: z.string().uuid(),
  listingId: z.string().uuid(),
  version: z
    .string()
    .trim()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .optional(),
  review: z
    .object({
      rating: z
        .number()
        .int()
        .min(MarketplaceDefaults.minRating)
        .max(MarketplaceDefaults.maxRating),
      title: z.string().trim().min(2).max(120),
      body: z.string().trim().max(2000).optional(),
    })
    .optional(),
});

export const analyticsQuerySchema = z.object({
  organizationId: z.string().uuid().optional(),
  publisherOrgId: z.string().uuid().optional(),
});
