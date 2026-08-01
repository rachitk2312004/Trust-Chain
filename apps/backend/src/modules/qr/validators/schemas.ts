import { z } from "zod";
import { QrFormatVersions, VerificationVisibility } from "@trustchain/config";

export const orgParamsSchema = z.object({
  id: z.string().uuid(),
});

export const orgDocParamsSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
});

export const orgQrParamsSchema = z.object({
  id: z.string().uuid(),
  publicCode: z.string().min(1),
});

export const orgDocQrParamsSchema = orgDocParamsSchema.extend({
  publicCode: z.string().min(1),
});

export const orgTemplateParamsSchema = z.object({
  id: z.string().uuid(),
  templateCode: z.string().min(1),
});

const formatVersionEnum = z.enum([
  QrFormatVersions.V1,
  QrFormatVersions.V2,
  QrFormatVersions.V3,
] as [string, ...string[]]);

export const createTemplateBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sizePx: z.number().int().min(128).max(2048).optional(),
  errorCorrection: z.enum(["L", "M", "Q", "H"]).optional(),
  foregroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  backgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  marginModules: z.number().int().min(0).max(16).optional(),
  printPageSize: z.enum(["A4", "Letter"]).optional(),
  printDpi: z.number().int().min(72).max(600).optional(),
  printMarginMm: z.number().min(0).max(50).optional(),
  printBleedMm: z.number().min(0).max(20).optional(),
  qrPerPage: z.number().int().min(1).max(16).optional(),
  isDefault: z.boolean().optional(),
});

export const updateTemplateBodySchema = createTemplateBodySchema.partial();

export const createQrBodySchema = z.object({
  formatVersion: formatVersionEnum.optional(),
  templatePublicCode: z.string().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  maxUses: z.number().int().positive().optional(),
  visibility: z
    .enum([VerificationVisibility.public, VerificationVisibility.restricted] as [
      string,
      ...string[],
    ])
    .optional(),
  label: z.string().max(200).optional(),
});

export const batchQrBodySchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(500),
  formatVersion: formatVersionEnum.optional(),
  templatePublicCode: z.string().min(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  visibility: z
    .enum([VerificationVisibility.public, VerificationVisibility.restricted] as [
      string,
      ...string[],
    ])
    .optional(),
});

export const batchRotateBodySchema = z.object({
  publicCodes: z.array(z.string().min(1)).min(1).max(500),
  formatVersion: formatVersionEnum.optional(),
  templatePublicCode: z.string().min(1).optional(),
});

export const printExportBodySchema = z.object({
  publicCodes: z.array(z.string().min(1)).min(1).max(100),
  templatePublicCode: z.string().min(1).optional(),
});
