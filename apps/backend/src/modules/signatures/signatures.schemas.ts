import { z } from "zod";
import {
  SignatureAlgorithms,
  SignatureStatusList,
  SupportedSignatureAlgorithms,
} from "@trustchain/config";

export const organizationIdQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const signatureIdParamsSchema = z.object({
  signatureId: z.string().uuid(),
});

export const listSignaturesQuerySchema = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(SignatureStatusList as [string, ...string[]]).optional(),
  documentId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const createSignatureBodySchema = z.object({
  organizationId: z.string().uuid(),
  documentId: z.string().uuid().nullable().optional(),
  certificateId: z.string().uuid().nullable().optional(),
  algorithm: z
    .enum([
      SignatureAlgorithms.rsaSha256,
      SignatureAlgorithms.ecdsaP256Sha256,
      SignatureAlgorithms.ed25519,
    ] as [string, ...string[]])
    .default(SignatureAlgorithms.rsaSha256),
  /** Optional PEM private key. When omitted, a keypair is generated (private key returned once). */
  privateKeyPem: z.string().min(32).max(16_000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  /** Optional content hash override (otherwise taken from document current version when linked). */
  contentHash: z.string().min(8).max(128).nullable().optional(),
});

export const revokeSignatureBodySchema = z.object({
  organizationId: z.string().uuid(),
  reason: z.string().max(1000).optional(),
});

export const verifySignatureBodySchema = z.object({
  organizationId: z.string().uuid(),
});

/** Phase D Step 2 — workflow verify (stored or detached). */
export const verifyWorkflowBodySchema = z
  .object({
    organizationId: z.string().uuid(),
    signatureId: z.string().uuid().optional(),
    detached: z
      .object({
        signerId: z.string().uuid(),
        algorithm: z
          .enum([
            SignatureAlgorithms.rsaSha256,
            SignatureAlgorithms.ecdsaP256Sha256,
            SignatureAlgorithms.ed25519,
          ] as [string, ...string[]])
          .default(SignatureAlgorithms.rsaSha256),
        publicKeyPem: z.string().min(32).max(16_000),
        signatureValue: z.string().min(8).max(16_000),
        signedAt: z.string().datetime(),
        expiresAt: z.string().datetime().nullable().optional(),
        metadata: z.record(z.unknown()).optional(),
        payload: z.union([
          z.string().min(1).max(512_000),
          z.record(z.unknown()),
          z.object({
            content: z.string().min(1).max(512_000),
            contentType: z.string().max(200).optional(),
          }),
        ]),
        publicId: z.string().min(3).max(128).optional(),
        payloadHash: z.string().min(8).max(128).optional(),
        integrityHash: z.string().min(8).max(128).optional(),
        status: z.enum(SignatureStatusList as [string, ...string[]]).optional(),
      })
      .optional(),
  })
  .refine((body) => Boolean(body.signatureId) || Boolean(body.detached), {
    message: "Provide signatureId or detached verification materials",
  });

const workflowSignShared = {
  organizationId: z.string().uuid(),
  algorithm: z
    .enum([
      SignatureAlgorithms.rsaSha256,
      SignatureAlgorithms.ecdsaP256Sha256,
      SignatureAlgorithms.ed25519,
    ] as [string, ...string[]])
    .optional()
    .default(SignatureAlgorithms.rsaSha256),
  privateKeyPem: z.string().min(32).max(16_000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
};

export const signDocumentBodySchema = z.object({
  ...workflowSignShared,
  documentId: z.string().uuid(),
});

export const signCertificateBodySchema = z.object({
  ...workflowSignShared,
  certificateId: z.string().uuid(),
});

export const signDetachedBodySchema = z.object({
  ...workflowSignShared,
  payload: z.union([
    z.string().min(1).max(512_000),
    z.record(z.unknown()),
    z.object({
      content: z.string().min(1).max(512_000),
      contentType: z.string().max(200).optional(),
    }),
  ]),
});

export const historyQuerySchema = z.object({
  organizationId: z.string().uuid(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const analyticsQuerySchema = z.object({
  organizationId: z.string().uuid(),
});

export const adminReprocessBodySchema = z.object({
  organizationId: z.string().uuid(),
  signatureIds: z.array(z.string().uuid()).max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const adminCleanupBodySchema = z.object({
  organizationId: z.string().uuid(),
  eventDays: z.number().int().min(1).max(3650).optional(),
  approvalEventDays: z.number().int().min(1).max(3650).optional(),
  workflowDays: z.number().int().min(1).max(3650).optional(),
  artifactDays: z.number().int().min(1).max(3650).optional(),
  diagnosticEventDays: z.number().int().min(1).max(3650).optional(),
});

export const supportedAlgorithmDefault = SupportedSignatureAlgorithms[0];
