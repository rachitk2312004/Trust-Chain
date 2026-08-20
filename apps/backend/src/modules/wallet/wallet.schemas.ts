import { z } from "zod";

export const myCertificatesQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const myCertificateIdParamsSchema = z.object({
  certificateId: z.string().uuid(),
});

export const myCertificateExportParamsSchema = myCertificateIdParamsSchema.extend({
  format: z.enum(["pdf", "png", "svg"]),
});
