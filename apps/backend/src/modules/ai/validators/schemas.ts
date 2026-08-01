import { z } from "zod";

export const orgParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orgJobParamsSchema = z.object({
  id: z.string().uuid(),
  jobId: z.string().min(1),
});

export const jobParamsSchema = z.object({
  jobId: z.string().min(1),
});

export const aiDocumentBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  documentId: z.string().uuid(),
  documentVersionId: z.string().uuid().optional(),
  engine: z.string().min(1).max(64).optional(),
  options: z.record(z.unknown()).optional(),
});

export const aiSearchBodySchema = z.object({
  organizationId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
  query: z.string().min(1).max(4000),
  limit: z.number().int().min(1).max(50).optional(),
});

export const aiReviewBodySchema = z.object({
  status: z.enum(["pending_review", "approved", "rejected", "escalated"]),
  notes: z.string().max(4000).optional(),
});
