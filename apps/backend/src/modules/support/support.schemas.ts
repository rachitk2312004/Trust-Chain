import { z } from "zod";

export const InquiryStatuses = {
  open: "open",
  answered: "answered",
  closed: "closed",
} as const;

export const BugStatuses = {
  open: "open",
  acknowledged: "acknowledged",
  inProgress: "in_progress",
  fixed: "fixed",
  wontFix: "wont_fix",
} as const;

export const ALLOWED_BUG_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export const MAX_BUG_IMAGE_BYTES = 2 * 1024 * 1024;

export const inquiryIdParamsSchema = z.object({
  inquiryId: z.string().uuid(),
});

export const bugIdParamsSchema = z.object({
  bugId: z.string().uuid(),
});

export const createInquiryBodySchema = z.object({
  subject: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(8000),
  organizationId: z.string().uuid().optional(),
});

export const inquiryMessageBodySchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

export const createBugBodySchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(8).max(8000),
  organizationId: z.string().uuid().optional(),
  imageBase64: z.string().min(1).max(4_000_000).optional(),
  imageContentType: z.enum(ALLOWED_BUG_IMAGE_TYPES).optional(),
});

export const bugResponseBodySchema = z.object({
  body: z.string().trim().min(1).max(8000),
  status: z
    .enum([
      BugStatuses.open,
      BugStatuses.acknowledged,
      BugStatuses.inProgress,
      BugStatuses.fixed,
      BugStatuses.wontFix,
    ])
    .optional(),
});

export const bugCommentBodySchema = z.object({
  body: z.string().trim().min(1).max(8000),
});
