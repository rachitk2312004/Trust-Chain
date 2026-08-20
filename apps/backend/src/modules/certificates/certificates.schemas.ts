import { z } from "zod";
import { CertificateStatusList, CertificateTemplateStatuses } from "@trustchain/config";

export const organizationIdQuerySchema = z.object({
  organizationId: z.string().uuid(),
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

export const createTemplateBodySchema = z.object({
  organizationId: z.string().uuid(),
  code: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, "code must be alphanumeric"),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  layout: z.record(z.unknown()).optional(),
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
  /** When true and documentId is set, create a document QR and link it. */
  createQr: z.boolean().optional().default(false),
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
