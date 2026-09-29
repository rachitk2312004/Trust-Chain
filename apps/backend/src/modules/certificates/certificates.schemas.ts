import { z } from "zod";
import { CertificateStatusList, CertificateTemplateStatuses } from "@trustchain/config";

export const organizationIdQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const lookupRecipientQuerySchema = z.object({
  organizationId: z.string().uuid(),
  q: z.string().trim().min(2).max(200),
});

export const listCertificatesQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(CertificateStatusList as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const certificateIdParamsSchema = z.object({
  certificateId: z.string().uuid(),
});

export const templateIdParamsSchema = z.object({
  templateId: z.string().uuid(),
});

export function slugifyTemplateCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export const createTemplateBodySchema = z.object({
  organizationId: z.string().uuid(),
  code: z.preprocess(
    (value) => (typeof value === "string" ? slugifyTemplateCode(value) : value),
    z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9]+(?:[_-]?[a-z0-9]+)*$/, "Use letters, numbers, hyphens, or underscores"),
  ),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  layout: z.record(z.string(), z.unknown()).optional(),
});

export const updateTemplateBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  layout: z.record(z.unknown()).optional(),
  status: z
    .enum([
      CertificateTemplateStatuses.active,
      CertificateTemplateStatuses.archived,
    ] as [string, ...string[]])
    .optional(),
});

export const listTemplatesQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z
    .enum([
      CertificateTemplateStatuses.active,
      CertificateTemplateStatuses.archived,
    ] as [string, ...string[]])
    .optional(),
});

export const issueCertificateBodySchema = z.object({
  organizationId: z.string().uuid(),
  title: z.string().min(1).max(300),
  description: z.string().max(4000).nullable().optional(),
  recipientName: z.string().min(1).max(200),
  recipientEmail: z.string().email().nullable().optional(),
  recipientUserId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  /** Embed and register a verification QR (default true). */
  createQr: z.boolean().optional().default(true),
  /** Anchor the certificate document hash on-chain (default true). */
  publishToChain: z.boolean().optional().default(true),
});

export const previewTemplateBodySchema = z.object({
  organizationId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  layout: z.record(z.unknown()).optional(),
  title: z.string().min(1).max(300).optional(),
  recipientName: z.string().min(1).max(200).optional(),
});

export const publishCertificateBodySchema = z.object({
  organizationId: z.string().uuid(),
  publishToChain: z.boolean().optional().default(true),
});

export const revokeCertificateBodySchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});

export const verifyCertificateBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
});

export const historyQuerySchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const bulkJobIdParamsSchema = z.object({
  jobId: z.string().uuid(),
});

export const bulkPreviewBodySchema = z.object({
  organizationId: z.string().uuid(),
  format: z.enum(["csv", "json"]),
  content: z.string().min(1).max(5_000_000),
  defaultTemplateId: z.string().uuid().nullable().optional(),
});

export const bulkStartBodySchema = z.object({
  organizationId: z.string().uuid(),
  format: z.enum(["csv", "json"]),
  content: z.string().min(1).max(5_000_000),
  defaultTitle: z.string().min(1).max(300).nullable().optional(),
  defaultTemplateId: z.string().uuid().nullable().optional(),
  rollbackOnCancel: z.boolean().optional().default(true),
  requireAllValid: z.boolean().optional().default(true),
});

export const bulkCancelBodySchema = z.object({
  organizationId: z.string().uuid(),
});

export const analyticsQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const adminReprocessBodySchema = z.object({
  organizationId: z.string().uuid(),
  certificateIds: z.array(z.string().uuid()).max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  renderFormat: z.enum(["pdf", "png", "svg"]).optional(),
  skipRender: z.boolean().optional(),
});

export const adminCleanupBodySchema = z.object({
  organizationId: z.string().uuid(),
  eventDays: z.number().int().min(1).max(3650).optional(),
  bulkJobDays: z.number().int().min(1).max(3650).optional(),
  temporaryAssetEventDays: z.number().int().min(1).max(3650).optional(),
});
