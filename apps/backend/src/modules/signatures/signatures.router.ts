import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  adminCleanupBodySchema,
  adminReprocessBodySchema,
  analyticsQuerySchema,
  createSignatureBodySchema,
  historyQuerySchema,
  listSignaturesQuerySchema,
  organizationIdQuerySchema,
  revokeSignatureBodySchema,
  signCertificateBodySchema,
  signDetachedBodySchema,
  signDocumentBodySchema,
  signatureIdParamsSchema,
  verifySignatureBodySchema,
  verifyWorkflowBodySchema,
} from "./signatures.schemas.js";
import {
  approveWorkflowBodySchema,
  cancelWorkflowBodySchema,
  createWorkflowBodySchema,
  listWorkflowsQuerySchema,
  rejectWorkflowBodySchema,
  workflowIdParamsSchema,
} from "./signatures.approval.schemas.js";
import * as service from "./signatures.service.js";
import * as workflow from "./signatures.workflow.js";
import * as approvalWorkflow from "./signatures.approval.workflow.js";

export const signaturesRouter = Router();

signaturesRouter.use(requireAuth);

signaturesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createSignatureBodySchema, req.body);
    const data = await service.createSignature(req.user.id, body);
    res.status(201).json(data);
  }),
);

signaturesRouter.post(
  "/document",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(signDocumentBodySchema, req.body);
    const data = await workflow.signDocumentWorkflow(req.user.id, body);
    res.status(201).json(data);
  }),
);

signaturesRouter.post(
  "/certificate",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(signCertificateBodySchema, req.body);
    const data = await workflow.signCertificateWorkflow(req.user.id, body);
    res.status(201).json(data);
  }),
);

signaturesRouter.post(
  "/detached",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(signDetachedBodySchema, req.body);
    const data = await workflow.signDetachedWorkflow(req.user.id, body);
    res.status(201).json(data);
  }),
);

signaturesRouter.post(
  "/verify",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(verifyWorkflowBodySchema, req.body);
    const data = await workflow.verifySignatureWorkflow(req.user.id, body);
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getSignatureAnalyticsOverview(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/analytics/workflows",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getSignatureWorkflowAnalytics(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/analytics/algorithms",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getSignatureAlgorithmAnalytics(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/analytics/verifications",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getSignatureVerificationAnalytics(
      req.user.id,
      query.organizationId,
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/analytics/detached",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getSignatureDetachedAnalytics(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/admin/reprocess",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(adminReprocessBodySchema, req.body);
    const data = await service.adminReprocessSignatures(req.user.id, body.organizationId, {
      signatureIds: body.signatureIds,
      limit: body.limit,
    });
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/admin/cleanup",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(adminCleanupBodySchema, req.body);
    const data = await service.adminCleanupSignatures(req.user.id, body.organizationId, {
      eventDays: body.eventDays,
      approvalEventDays: body.approvalEventDays,
      workflowDays: body.workflowDays,
      artifactDays: body.artifactDays,
      diagnosticEventDays: body.diagnosticEventDays,
    });
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/workflows",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createWorkflowBodySchema, req.body);
    const data = await approvalWorkflow.createApprovalWorkflow(req.user.id, body);
    res.status(201).json(data);
  }),
);

signaturesRouter.get(
  "/workflows",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listWorkflowsQuerySchema, req.query);
    const data = await approvalWorkflow.listApprovalWorkflows(req.user.id, query.organizationId, {
      status: query.status,
      signatureId: query.signatureId,
      reviewerId: query.reviewerId,
      limit: query.limit,
      offset: query.offset,
    });
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/workflows/:workflowId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(workflowIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const data = await approvalWorkflow.getApprovalWorkflow(
      req.user.id,
      query.organizationId,
      params.workflowId,
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/workflows/:workflowId/approve",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(workflowIdParamsSchema, req.params);
    const body = parseBody(approveWorkflowBodySchema, req.body);
    const data = await approvalWorkflow.approveWorkflowStep(
      req.user.id,
      body.organizationId,
      params.workflowId,
      body.comment,
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/workflows/:workflowId/reject",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(workflowIdParamsSchema, req.params);
    const body = parseBody(rejectWorkflowBodySchema, req.body);
    const data = await approvalWorkflow.rejectWorkflowStep(
      req.user.id,
      body.organizationId,
      params.workflowId,
      body.comment,
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/workflows/:workflowId/cancel",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(workflowIdParamsSchema, req.params);
    const body = parseBody(cancelWorkflowBodySchema, req.body);
    const data = await approvalWorkflow.cancelApprovalWorkflow(
      req.user.id,
      body.organizationId,
      params.workflowId,
      body.reason,
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listSignaturesQuerySchema, req.query);
    const data = await service.listSignatures(req.user.id, query.organizationId, {
      status: query.status,
      documentId: query.documentId,
      limit: query.limit,
      offset: query.offset,
    });
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/:signatureId/history",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(signatureIdParamsSchema, req.params);
    const query = parseQuery(historyQuerySchema, req.query);
    const data = await service.getSignatureHistory(
      req.user.id,
      query.organizationId,
      params.signatureId,
      { limit: query.limit, offset: query.offset },
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/:signatureId/verify",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(signatureIdParamsSchema, req.params);
    const body = parseBody(verifySignatureBodySchema, req.body ?? {});
    const data = await service.verifySignature(
      req.user.id,
      body.organizationId,
      params.signatureId,
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.post(
  "/:signatureId/revoke",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(signatureIdParamsSchema, req.params);
    const body = parseBody(revokeSignatureBodySchema, req.body);
    const data = await workflow.revokeSignatureWorkflow(
      req.user.id,
      body.organizationId,
      params.signatureId,
      body.reason,
    );
    res.status(200).json(data);
  }),
);

signaturesRouter.get(
  "/:signatureId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(signatureIdParamsSchema, req.params);
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const data = await service.getSignature(
      req.user.id,
      query.organizationId,
      params.signatureId,
    );
    res.status(200).json(data);
  }),
);
