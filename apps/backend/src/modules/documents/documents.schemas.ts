import { z } from "zod";
import {
  DocumentAccessSubjectTypes,
  DocumentAllowedMimeTypes,
  DocumentPermissions,
  DocumentStatuses,
} from "@trustchain/config";

export const orgIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orgDocumentParamsSchema = orgIdParamsSchema.extend({
  documentId: z.string().uuid(),
});

export const orgDocumentVersionParamsSchema = orgDocumentParamsSchema.extend({
  versionId: z.string().uuid(),
});

export const orgCategoryParamsSchema = orgIdParamsSchema.extend({
  categoryId: z.string().uuid(),
});

export const orgTagParamsSchema = orgIdParamsSchema.extend({
  tagId: z.string().uuid(),
});

export const orgShareParamsSchema = orgDocumentParamsSchema.extend({
  shareId: z.string().uuid(),
});

const mimeSchema = z.enum(DocumentAllowedMimeTypes as unknown as [string, ...string[]]);

export const createDocumentBodySchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  tagIds: z.array(z.string().uuid()).max(50).optional(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const patchDocumentBodySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  tagIds: z.array(z.string().uuid()).max(50).optional(),
  status: z
    .enum([DocumentStatuses.draft, DocumentStatuses.active] as [string, ...string[]])
    .optional(),
});

export const uploadUrlBodySchema = z.object({
  mimeType: mimeSchema,
  originalFileName: z.string().min(1).max(512),
  expectedSizeBytes: z.number().int().positive().optional(),
});

export const confirmVersionBodySchema = z.object({
  uploadSessionId: z.string().uuid(),
  contentHash: z.string().regex(/^[a-f0-9]{64}$/i, "contentHash must be a SHA-256 hex digest"),
  mimeType: mimeSchema,
  sizeBytes: z.number().int().positive(),
  originalFileName: z.string().min(1).max(512),
  activate: z.boolean().optional(),
});

export const listDocumentsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  status: z
    .enum([
      DocumentStatuses.pendingUpload,
      DocumentStatuses.draft,
      DocumentStatuses.active,
      DocumentStatuses.archived,
      DocumentStatuses.expired,
    ] as [string, ...string[]])
    .optional(),
  categoryId: z.string().uuid().optional(),
  tag: z.string().max(100).optional(),
  expiresBefore: z.string().datetime().optional(),
  includeDeleted: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const expirationBodySchema = z.object({
  expiresAt: z.string().datetime().nullable(),
});

export const categoryBodySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
});

export const tagBodySchema = z.object({
  name: z.string().min(1).max(80),
});

export const createShareBodySchema = z
  .object({
    sharedWithUserId: z.string().uuid().optional(),
    sharedWithEmail: z.string().email().optional(),
    permission: z.enum([
      DocumentPermissions.view,
      DocumentPermissions.download,
      DocumentPermissions.edit,
      DocumentPermissions.manage,
    ] as [string, ...string[]]),
    expiresAt: z.string().datetime().optional().nullable(),
  })
  .refine((v) => Boolean(v.sharedWithUserId || v.sharedWithEmail), {
    message: "sharedWithUserId or sharedWithEmail is required",
  });

export const accessPoliciesBodySchema = z.object({
  policies: z
    .array(
      z.object({
        subjectType: z.enum([
          DocumentAccessSubjectTypes.user,
          DocumentAccessSubjectTypes.role,
          DocumentAccessSubjectTypes.organization,
        ] as [string, ...string[]]),
        subjectId: z.string().min(1).max(200),
        permission: z.enum([
          DocumentPermissions.view,
          DocumentPermissions.download,
          DocumentPermissions.edit,
          DocumentPermissions.manage,
        ] as [string, ...string[]]),
      }),
    )
    .max(100),
});
