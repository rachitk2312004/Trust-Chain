import { z } from "zod";
import { VerificationVisibility } from "@trustchain/config";

export const publicVerifyBodySchema = z
  .object({
    verificationCode: z.string().min(1).optional(),
    contentHash: z
      .string()
      .regex(/^[a-fA-F0-9]{64}$/)
      .optional(),
    transactionHash: z.string().min(1).optional(),
    publicVerifyCode: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
  })
  .refine(
    (v) =>
      Boolean(
        v.verificationCode || v.contentHash || v.transactionHash || v.publicVerifyCode || v.token,
      ),
    { message: "One lookup field is required" },
  );

export const orgDocParamsSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
});

export const orgDocLinkParamsSchema = orgDocParamsSchema.extend({
  publicCode: z.string().min(1),
});

export const visibilityBodySchema = z.object({
  visibility: z.enum([
    VerificationVisibility.private,
    VerificationVisibility.organization,
    VerificationVisibility.public,
    VerificationVisibility.restricted,
  ] as [string, ...string[]]),
});

export const createLinkBodySchema = z.object({
  label: z.string().max(200).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().positive().optional(),
  freezeReport: z.boolean().optional(),
  visibility: z
    .enum([VerificationVisibility.public, VerificationVisibility.restricted] as [
      string,
      ...string[],
    ])
    .optional(),
});
