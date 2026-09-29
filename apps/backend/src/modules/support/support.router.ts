import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  bugCommentBodySchema,
  bugIdParamsSchema,
  bugResponseBodySchema,
  createBugBodySchema,
  createInquiryBodySchema,
  inquiryIdParamsSchema,
  inquiryMessageBodySchema,
} from "./support.schemas.js";
import * as service from "./support.service.js";

export const supportRouter = Router();

supportRouter.use(requireAuth);

supportRouter.get(
  "/summary",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.getSupportSummary(req.user.id);
    res.status(200).json(data);
  }),
);

supportRouter.get(
  "/inquiries",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.listInquiries(req.user.id);
    res.status(200).json(data);
  }),
);

supportRouter.post(
  "/inquiries",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createInquiryBodySchema, req.body);
    const data = await service.createInquiry(req.user.id, body);
    res.status(201).json(data);
  }),
);

supportRouter.get(
  "/inquiries/:inquiryId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(inquiryIdParamsSchema, req.params);
    const data = await service.getInquiry(req.user.id, params.inquiryId);
    res.status(200).json(data);
  }),
);

supportRouter.post(
  "/inquiries/:inquiryId/messages",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(inquiryIdParamsSchema, req.params);
    const body = parseBody(inquiryMessageBodySchema, req.body);
    const data = await service.postInquiryMessage(req.user.id, params.inquiryId, body.body);
    res.status(201).json(data);
  }),
);

supportRouter.post(
  "/inquiries/:inquiryId/close",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(inquiryIdParamsSchema, req.params);
    const data = await service.closeInquiry(req.user.id, params.inquiryId);
    res.status(200).json(data);
  }),
);

supportRouter.get(
  "/bugs",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.listBugs(req.user.id);
    res.status(200).json(data);
  }),
);

supportRouter.post(
  "/bugs",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createBugBodySchema, req.body);
    const data = await service.createBug(req.user.id, body);
    res.status(201).json(data);
  }),
);

supportRouter.get(
  "/bugs/:bugId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(bugIdParamsSchema, req.params);
    const data = await service.getBug(req.user.id, params.bugId);
    res.status(200).json(data);
  }),
);

supportRouter.get(
  "/bugs/:bugId/image",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(bugIdParamsSchema, req.params);
    const data = await service.getBugImage(req.user.id, params.bugId);
    res.setHeader("Content-Type", data.contentType);
    res.setHeader("Cache-Control", "private, max-age=120");
    res.status(200).send(data.body);
  }),
);

supportRouter.post(
  "/bugs/:bugId/responses",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(bugIdParamsSchema, req.params);
    const body = parseBody(bugResponseBodySchema, req.body);
    const data = await service.respondToBug(req.user.id, params.bugId, body);
    res.status(201).json(data);
  }),
);

supportRouter.post(
  "/bugs/:bugId/comments",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(bugIdParamsSchema, req.params);
    const body = parseBody(bugCommentBodySchema, req.body);
    const data = await service.commentOnBug(req.user.id, params.bugId, body.body);
    res.status(201).json(data);
  }),
);
