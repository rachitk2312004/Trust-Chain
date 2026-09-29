import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  addMembersBodySchema,
  conversationIdParamsSchema,
  createConversationBodySchema,
  deleteMessagesBodySchema,
  editMessageBodySchema,
  listMessagesQuerySchema,
  memberUserParamsSchema,
  messageIdParamsSchema,
  organizationIdQuerySchema,
  sendMessageBodySchema,
  syncInboxQuerySchema,
} from "./messages.schemas.js";
import * as service from "./messages.service.js";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get(
  "/sync",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(syncInboxQuerySchema, req.query);
    const data = await service.syncInbox(req.user.id, query.organizationId, query.conversationId);
    res.status(200).json(data);
  }),
);

messagesRouter.get(
  "/directory",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const data = await service.listDirectory(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

messagesRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(organizationIdQuerySchema, req.query);
    const data = await service.listConversations(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

messagesRouter.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createConversationBodySchema, req.body);
    const data = await service.createConversation(req.user.id, body);
    res.status(201).json(data);
  }),
);

messagesRouter.get(
  "/conversations/:conversationId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(conversationIdParamsSchema, req.params);
    const data = await service.getConversation(req.user.id, params.conversationId);
    res.status(200).json(data);
  }),
);

messagesRouter.get(
  "/conversations/:conversationId/messages",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(conversationIdParamsSchema, req.params);
    const query = parseQuery(listMessagesQuerySchema, req.query);
    const data = await service.listMessages(req.user.id, params.conversationId, query);
    res.status(200).json(data);
  }),
);

messagesRouter.post(
  "/conversations/:conversationId/messages",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(conversationIdParamsSchema, req.params);
    const body = parseBody(sendMessageBodySchema, req.body);
    const data = await service.sendMessage(req.user.id, params.conversationId, body.body);
    res.status(201).json(data);
  }),
);

messagesRouter.post(
  "/conversations/:conversationId/read",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(conversationIdParamsSchema, req.params);
    const data = await service.markConversationRead(req.user.id, params.conversationId);
    res.status(200).json(data);
  }),
);

messagesRouter.post(
  "/conversations/:conversationId/messages/delete",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(conversationIdParamsSchema, req.params);
    const body = parseBody(deleteMessagesBodySchema, req.body);
    const data = await service.deleteMessages(
      req.user.id,
      params.conversationId,
      body.messageIds,
      body.scope,
    );
    res.status(200).json(data);
  }),
);

messagesRouter.patch(
  "/conversations/:conversationId/messages/:messageId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(messageIdParamsSchema, req.params);
    const body = parseBody(editMessageBodySchema, req.body);
    const data = await service.editMessage(
      req.user.id,
      params.conversationId,
      params.messageId,
      body.body,
    );
    res.status(200).json(data);
  }),
);

messagesRouter.delete(
  "/conversations/:conversationId/messages/:messageId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(messageIdParamsSchema, req.params);
    const data = await service.deleteMessages(req.user.id, params.conversationId, [params.messageId], "all");
    res.status(200).json(data);
  }),
);

messagesRouter.post(
  "/conversations/:conversationId/members",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(conversationIdParamsSchema, req.params);
    const body = parseBody(addMembersBodySchema, req.body);
    const data = await service.addConversationMembers(
      req.user.id,
      params.conversationId,
      body.memberIds,
    );
    res.status(200).json(data);
  }),
);

messagesRouter.delete(
  "/conversations/:conversationId/members/:userId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(memberUserParamsSchema, req.params);
    const data = await service.removeConversationMember(
      req.user.id,
      params.conversationId,
      params.userId,
    );
    res.status(200).json(data);
  }),
);
