import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  adminCleanupBodySchema,
  adminReprocessBodySchema,
  analyticsQuerySchema,
  bulkCancelBodySchema,
  bulkJobIdParamsSchema,
  bulkPreviewBodySchema,
  bulkStartBodySchema,
  certificateIdParamsSchema,
  createTemplateBodySchema,
  historyQuerySchema,
  issueCertificateBodySchema,
  listCertificatesQuerySchema,
  listTemplatesQuerySchema,
  organizationIdQuerySchema,
  revokeCertificateBodySchema,
  templateIdParamsSchema,
  updateTemplateBodySchema,
  verifyCertificateBodySchema,
} from "./certificates.schemas.js";
import * as service from "./certificates.service.js";
import * as bulk from "./certificates.bulk.js";

export const certificatesRouter = Router();

certificatesRouter.use(requireAuth);

certificatesRouter.post(
  "/templates",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createTemplateBodySchema, req.body);
    const data = await service.createCertificateTemplate(req.user.id, body);
    res.status(201).json(data);
  }),
);

certificatesRouter.get(
  "/templates",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listTemplatesQuerySchema, req.query);
    const data = await service.listCertificateTemplates(
      req.user.id,
      query.organizationId,
      query.status,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/templates/:templateId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(templateIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const data = await service.getCertificateTemplate(
      req.user.id,
      query.organizationId,
      params.templateId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.patch(
  "/templates/:templateId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(templateIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const body = parseBody(updateTemplateBodySchema, req.body);
    const data = await service.patchCertificateTemplate(
      req.user.id,
      query.organizationId,
      params.templateId,
      body,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.post(
  "/bulk/preview",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(bulkPreviewBodySchema, req.body);
    const data = await bulk.previewCertificateBulk(req.user.id, body);
    res.status(200).json(data);
  }),
);

certificatesRouter.post(
  "/bulk",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(bulkStartBodySchema, req.body);
    const data = await bulk.startCertificateBulk(req.user.id, body);
    res.status(202).json(data);
  }),
);

certificatesRouter.get(
  "/bulk/:jobId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(bulkJobIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const data = await bulk.getCertificateBulkJob(
      req.user.id,
      query.organizationId,
      params.jobId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.post(
  "/bulk/:jobId/cancel",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(bulkJobIdParamsSchema, req.params);
    const body = parseBody(bulkCancelBodySchema, req.body ?? {});
    const data = await bulk.cancelCertificateBulkJob(
      req.user.id,
      body.organizationId,
      params.jobId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getCertificateAnalyticsOverview(
      req.user.id,
      query.organizationId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/analytics/templates",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getCertificateTemplateAnalytics(
      req.user.id,
      query.organizationId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/analytics/issuance",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getCertificateIssuanceAnalytics(
      req.user.id,
      query.organizationId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/analytics/downloads",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getCertificateDownloadAnalytics(
      req.user.id,
      query.organizationId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/analytics/verifications",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getCertificateVerificationAnalytics(
      req.user.id,
      query.organizationId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.post(
  "/admin/reprocess",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(adminReprocessBodySchema, req.body);
    const data = await service.adminReprocessCertificates(req.user.id, body.organizationId, {
      certificateIds: body.certificateIds,
      limit: body.limit,
      renderFormat: body.renderFormat,
      skipRender: body.skipRender,
    });
    res.status(200).json(data);
  }),
);

certificatesRouter.post(
  "/admin/cleanup",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(adminCleanupBodySchema, req.body);
    const data = await service.adminCleanupCertificates(req.user.id, body.organizationId, {
      eventDays: body.eventDays,
      bulkJobDays: body.bulkJobDays,
      temporaryAssetEventDays: body.temporaryAssetEventDays,
    });
    res.status(200).json(data);
  }),
);

certificatesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(issueCertificateBodySchema, req.body);
    const data = await service.issueCertificate(req.user.id, body);
    res.status(201).json(data);
  }),
);

certificatesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listCertificatesQuerySchema, req.query);
    const data = await service.listCertificates(req.user.id, query.organizationId, {
      status: query.status,
      limit: query.limit,
      offset: query.offset,
    });
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/:certificateId/history",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(certificateIdParamsSchema, req.params);
    const query = parseQuery(historyQuerySchema, req.query);
    const data = await service.getCertificateHistory(
      req.user.id,
      query.organizationId,
      params.certificateId,
      { limit: query.limit, offset: query.offset },
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/:certificateId/pdf",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(certificateIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const file = await service.downloadCertificateExport(
      req.user.id,
      query.organizationId,
      params.certificateId,
      "pdf",
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    if (file.warnings.length) res.setHeader("X-Certificate-Warnings", file.warnings.join("; "));
    res.status(200).send(file.body);
  }),
);

certificatesRouter.get(
  "/:certificateId/png",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(certificateIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const file = await service.downloadCertificateExport(
      req.user.id,
      query.organizationId,
      params.certificateId,
      "png",
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    if (file.warnings.length) res.setHeader("X-Certificate-Warnings", file.warnings.join("; "));
    res.status(200).send(file.body);
  }),
);

certificatesRouter.get(
  "/:certificateId/svg",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(certificateIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const file = await service.downloadCertificateExport(
      req.user.id,
      query.organizationId,
      params.certificateId,
      "svg",
    );
    res.setHeader("Content-Type", file.contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
    if (file.warnings.length) res.setHeader("X-Certificate-Warnings", file.warnings.join("; "));
    res.status(200).send(file.body);
  }),
);

certificatesRouter.post(
  "/:certificateId/verify",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(certificateIdParamsSchema, req.params);
    const body = parseBody(verifyCertificateBodySchema, req.body ?? {});
    const data = await service.verifyCertificateById(
      req.user.id,
      body.organizationId,
      params.certificateId,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.post(
  "/:certificateId/revoke",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(certificateIdParamsSchema, req.params);
    const body = parseBody(revokeCertificateBodySchema, req.body);
    const data = await service.revokeCertificate(
      req.user.id,
      body.organizationId,
      params.certificateId,
      body.reason,
    );
    res.status(200).json(data);
  }),
);

certificatesRouter.get(
  "/:certificateId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(certificateIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const data = await service.getCertificate(
      req.user.id,
      query.organizationId,
      params.certificateId,
    );
    res.status(200).json(data);
  }),
);
