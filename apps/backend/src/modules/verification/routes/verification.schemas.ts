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

export const checkHistoryQuerySchema = z.object({
  kind: z.enum(["intake", "documents", "certificates", "hashes", "identifiers"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const bulkVerifyBodySchema = z.object({
  category: z.enum(["documents", "certificates", "hashes", "identifiers"]),
  documentIds: z.array(z.string().uuid()).max(20).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  certificateIds: z.array(z.string().uuid()).max(20).optional(),
  hashes: z.array(z.string().min(8).max(2048)).max(50).optional(),
  identifiers: z.array(z.string().min(1).max(2048)).max(50).optional(),
  claims: z
    .array(
      z.object({
        identifier: z.string().min(1).max(2048),
        name: z.string().trim().max(200).optional(),
      }),
    )
    .max(50)
    .optional(),
});

export const intakeVerifyBodySchema = z.object({
  submissions: z
    .array(
      z.object({
        fileName: z.string().trim().min(1).max(240),
        contentHash: z.string().regex(/^[a-fA-F0-9]{64}$/),
        publicIds: z.array(z.string().min(3).max(80)).max(10).optional(),
        fileBase64: z.string().min(1).max(800_000).optional(),
        claimedName: z.string().trim().max(200).optional(),
      }),
    )
    .min(1)
    .max(50),
});
