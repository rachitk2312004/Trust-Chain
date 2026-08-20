import { z } from "zod";
import {
  ComplianceFrameworkList,
  EvidenceDefaults,
  EvidenceLinkTypeList,
  EvidenceStatusList,
} from "@trustchain/config";

const frameworkSchema = z.enum(ComplianceFrameworkList as [string, ...string[]]);

export const evidenceListQuerySchema = z.object({
  organizationId: z.string().uuid(),
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(EvidenceStatusList as [string, ...string[]]).optional(),
  framework: frameworkSchema.optional(),
  tag: z.string().trim().min(1).max(64).optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(EvidenceDefaults.maxLimit)
    .default(EvidenceDefaults.defaultLimit),
  offset: z.coerce.number().int().min(0).default(0),
});

export const evidenceIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const createEvidenceBodySchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().trim().min(2).max(300),
  description: z.string().trim().max(4000).optional().nullable(),
  contentText: z.string().max(EvidenceDefaults.maxContentBytes).optional().nullable(),
  objectKey: z.string().trim().max(1000).optional().nullable(),
  fileName: z.string().trim().max(500).optional().nullable(),
  mimeType: z.string().trim().max(200).optional().nullable(),
  sizeBytes: z.number().int().min(0).max(EvidenceDefaults.maxContentBytes).optional(),
  checksumSha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional()
    .nullable(),
  tags: z.array(z.string().trim().min(1).max(64)).max(EvidenceDefaults.maxTags).optional(),
  frameworks: z.array(frameworkSchema).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  actorIp: z.string().trim().max(64).optional().nullable(),
});

export const patchEvidenceBodySchema = z.object({
  title: z.string().trim().min(2).max(300).optional(),
  description: z.string().trim().max(4000).optional().nullable(),
  status: z.enum(EvidenceStatusList as [string, ...string[]]).optional(),
  tags: z.array(z.string().trim().min(1).max(64)).max(EvidenceDefaults.maxTags).optional(),
  frameworks: z.array(frameworkSchema).max(10).optional(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
  /// Creating a new content version
  contentText: z.string().max(EvidenceDefaults.maxContentBytes).optional().nullable(),
  objectKey: z.string().trim().max(1000).optional().nullable(),
  fileName: z.string().trim().max(500).optional().nullable(),
  mimeType: z.string().trim().max(200).optional().nullable(),
  sizeBytes: z.number().int().min(0).max(EvidenceDefaults.maxContentBytes).optional(),
  checksumSha256: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional()
    .nullable(),
  changeNote: z.string().trim().max(1000).optional().nullable(),
  revalidate: z.boolean().optional(),
  actorIp: z.string().trim().max(64).optional().nullable(),
});

export const linkEvidenceBodySchema = z.object({
  targetType: z.enum(EvidenceLinkTypeList as [string, ...string[]]),
  targetId: z.string().trim().min(1).max(128),
  label: z.string().trim().max(200).optional().nullable(),
  actorIp: z.string().trim().max(64).optional().nullable(),
});

export const exportEvidenceBodySchema = z.object({
  organizationId: z.string().uuid(),
  format: z.enum(["json", "csv"]).default("json"),
  status: z.enum(EvidenceStatusList as [string, ...string[]]).optional(),
  framework: frameworkSchema.optional(),
  tag: z.string().trim().min(1).max(64).optional(),
  q: z.string().trim().min(1).max(200).optional(),
});
