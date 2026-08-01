import { z } from "zod";
import {
  VerificationInternalStatuses,
  VerificationModes,
  VerificationOutcomes,
} from "@trustchain/config";

export const orgIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orgDocumentParamsSchema = orgIdParamsSchema.extend({
  documentId: z.string().uuid(),
});

export const orgVerificationParamsSchema = orgIdParamsSchema.extend({
  verificationId: z.string().uuid(),
});

export const verifyBodySchema = z.object({
  mode: z
    .enum([VerificationModes.sync, VerificationModes.async] as [string, ...string[]])
    .optional(),
  documentVersionId: z.string().uuid().optional(),
  expectedContentHash: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),
  rehashFromR2: z.boolean().optional(),
  requireAnchor: z.boolean().optional(),
  requireLiveChain: z.boolean().optional(),
  idempotencyKey: z.string().min(1).max(200).optional(),
  signature: z.string().min(1).optional(),
  intentNonce: z.union([z.string(), z.number()]).optional(),
  deadline: z.number().int().positive().optional(),
});

export const listVerificationsQuerySchema = z.object({
  status: z
    .enum([
      VerificationInternalStatuses.pending,
      VerificationInternalStatuses.processing,
      VerificationInternalStatuses.completed,
      VerificationInternalStatuses.failed,
    ] as [string, ...string[]])
    .optional(),
  outcome: z
    .enum([
      VerificationOutcomes.valid,
      VerificationOutcomes.invalid,
      VerificationOutcomes.revoked,
      VerificationOutcomes.expired,
      VerificationOutcomes.missing,
      VerificationOutcomes.tampered,
    ] as [string, ...string[]])
    .optional(),
  documentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
