import { Router } from "express";
import { DocumentStatuses, DeveloperEventTypes, PublicApiVersion } from "@trustchain/config";
import { prisma } from "@trustchain/database";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import * as certificates from "../certificates/certificates.service.js";
import * as certRepo from "../certificates/certificates.repository.js";
import { publishDeveloperEventSafe } from "./developer.delivery.js";
import {
  attachRequestId,
  enforceDeveloperRateLimit,
  requireDeveloperApiAuth,
  requireDeveloperCapability,
  trackDeveloperApiUsage,
  withIdempotency,
} from "./developer.middleware.js";
import { getUsageMetrics, listApiUsageEvents, toPublicUsageEvent } from "./developer.metrics.js";
import * as signatures from "../signatures/signatures.service.js";
import * as sigRepo from "../signatures/signatures.repository.js";
import { z } from "zod";

const idParamsSchema = z.object({ id: z.string().uuid() });

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const createDocumentBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

const createCertificateBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  recipientName: z.string().trim().min(1).max(500),
  description: z.string().trim().max(5000).nullable().optional(),
  recipientEmail: z.string().email().nullable().optional(),
  documentId: z.string().uuid().nullable().optional(),
  templateId: z.string().uuid().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const createSignatureBodySchema = z.object({
  documentId: z.string().uuid().nullable().optional(),
  certificateId: z.string().uuid().nullable().optional(),
  algorithm: z.string().trim().min(1).max(64).optional(),
  contentHash: z.string().trim().min(1).max(256).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

function requireActor(req: { developer?: { actorUserId: string | null } }): string {
  const actor = req.developer?.actorUserId;
  if (!actor) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "API key has no resolvable actor user; recreate the key as an organization admin",
    );
  }
  return actor;
}

function publicDocument(row: {
  id: string;
  organizationId: string;
  title: string;
  description: string | null;
  status: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    title: row.title,
    description: row.description,
    status: row.status,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const publicDeveloperApiRouter = Router();

publicDeveloperApiRouter.use(attachRequestId());
publicDeveloperApiRouter.use(requireDeveloperApiAuth());
publicDeveloperApiRouter.use(enforceDeveloperRateLimit());
publicDeveloperApiRouter.use(trackDeveloperApiUsage());
publicDeveloperApiRouter.use(withIdempotency());

publicDeveloperApiRouter.get(
  "/health",
  asyncHandler(async (req, res) => {
    res.status(200).json({
      ok: true,
      version: PublicApiVersion,
      organizationId: req.developer!.organizationId,
      authType: req.developer!.authType,
      requestId: req.requestId,
    });
  }),
);

publicDeveloperApiRouter.get(
  "/usage",
  requireDeveloperCapability("usage.read"),
  asyncHandler(async (req, res) => {
    const query = parseQuery(
      paginationSchema.extend({
        days: z.coerce.number().int().min(1).max(90).default(30),
      }),
      req.query,
    );
    const since = new Date(Date.now() - query.days * 24 * 60 * 60 * 1000);
    const metrics = await getUsageMetrics(req.developer!.organizationId, since);
    const events = await listApiUsageEvents({
      organizationId: req.developer!.organizationId,
      apiKeyId: req.developer!.authType === "api_key" ? req.developer!.apiKeyId : undefined,
      limit: query.limit,
      offset: query.offset,
    });
    res.status(200).json({
      metrics,
      requests: events.items.map(toPublicUsageEvent),
      total: events.total,
      limit: query.limit,
      offset: query.offset,
    });
  }),
);

publicDeveloperApiRouter.post(
  "/documents",
  requireDeveloperCapability("documents.write"),
  asyncHandler(async (req, res) => {
    const body = parseBody(createDocumentBodySchema, req.body);
    const actorUserId = requireActor(req);
    const organizationId = req.developer!.organizationId;

    const doc = await prisma.document.create({
      data: {
        organizationId,
        createdById: actorUserId,
        title: body.title,
        description: body.description ?? null,
        status: DocumentStatuses.pendingUpload,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    });

    publishDeveloperEventSafe({
      organizationId,
      eventType: DeveloperEventTypes.documentCreated,
      data: { documentId: doc.id, title: doc.title, source: "public_api" },
    });

    res.status(201).json({ document: publicDocument(doc) });
  }),
);

publicDeveloperApiRouter.get(
  "/documents/:id",
  requireDeveloperCapability("documents.read"),
  asyncHandler(async (req, res) => {
    const params = parseParams(idParamsSchema, req.params);
    const doc = await prisma.document.findFirst({
      where: {
        id: params.id,
        organizationId: req.developer!.organizationId,
        deletedAt: null,
      },
    });
    if (!doc) throw new AppError(404, "NOT_FOUND", "Document not found");
    res.status(200).json({ document: publicDocument(doc) });
  }),
);

publicDeveloperApiRouter.post(
  "/certificates",
  requireDeveloperCapability("certificates.write"),
  asyncHandler(async (req, res) => {
    const body = parseBody(createCertificateBodySchema, req.body);
    const actorUserId = requireActor(req);
    const data = await certificates.issueCertificate(actorUserId, {
      organizationId: req.developer!.organizationId,
      title: body.title,
      description: body.description,
      recipientName: body.recipientName,
      recipientEmail: body.recipientEmail,
      documentId: body.documentId,
      templateId: body.templateId,
      expiresAt: body.expiresAt,
      metadata: body.metadata,
    });
    res.status(201).json(data);
  }),
);

publicDeveloperApiRouter.get(
  "/certificates/:id",
  requireDeveloperCapability("certificates.read"),
  asyncHandler(async (req, res) => {
    const params = parseParams(idParamsSchema, req.params);
    const row = await certRepo.findCertificateById(
      req.developer!.organizationId,
      params.id,
    );
    if (!row) throw new AppError(404, "NOT_FOUND", "Certificate not found");
    res.status(200).json({ certificate: certRepo.toPublicCertificate(row) });
  }),
);

publicDeveloperApiRouter.post(
  "/signatures",
  requireDeveloperCapability("signatures.write"),
  asyncHandler(async (req, res) => {
    const body = parseBody(createSignatureBodySchema, req.body);
    const actorUserId = requireActor(req);
    const data = await signatures.createSignature(actorUserId, {
      organizationId: req.developer!.organizationId,
      documentId: body.documentId,
      certificateId: body.certificateId,
      algorithm: body.algorithm,
      contentHash: body.contentHash,
      expiresAt: body.expiresAt,
      metadata: body.metadata,
    });
    res.status(201).json(data);
  }),
);

publicDeveloperApiRouter.get(
  "/signatures/:id",
  requireDeveloperCapability("signatures.read"),
  asyncHandler(async (req, res) => {
    const params = parseParams(idParamsSchema, req.params);
    const row = await sigRepo.findSignatureById(
      req.developer!.organizationId,
      params.id,
    );
    if (!row) throw new AppError(404, "NOT_FOUND", "Signature not found");
    res.status(200).json({ signature: sigRepo.toPublicSignature(row) });
  }),
);
