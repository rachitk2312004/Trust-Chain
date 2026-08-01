import { z } from "zod";

export const orgIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orgDocumentParamsSchema = orgIdParamsSchema.extend({
  documentId: z.string().uuid(),
});

export const orgTxParamsSchema = orgIdParamsSchema.extend({
  txId: z.string().uuid(),
});

export const orgRetryParamsSchema = orgIdParamsSchema.extend({
  jobId: z.string().uuid(),
});

export const anchorBodySchema = z.object({
  documentVersionId: z.string().uuid().optional(),
});

export const revokeBodySchema = z.object({
  documentVersionId: z.string().uuid().optional(),
});
