import { z } from "zod";

export const createOrganizationBodySchema = z.object({
  name: z.string().min(2).max(200),
  slug: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  parentOrganizationId: z.string().uuid().optional(),
});

export const updateOrganizationBodySchema = z.object({
  name: z.string().min(2).max(200).optional(),
  status: z.enum(["active", "disabled"]).optional(),
  parentOrganizationId: z.string().uuid().nullable().optional(),
});

export const organizationIdParamsSchema = z.object({
  id: z.string().uuid(),
});
