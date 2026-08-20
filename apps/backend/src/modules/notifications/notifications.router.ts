import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  adminListQuerySchema,
  adminOutboxStatusQuerySchema,
  historyQuerySchema,
  listNotificationsQuerySchema,
  notificationIdParamsSchema,
  outboxIdParamsSchema,
  retentionPurgeBodySchema,
  retryDeadLettersBodySchema,
  updatePreferencesBodySchema,
} from "./notification.schemas.js";
import { openNotificationSse } from "./notification.sse.js";
import * as admin from "./notification.admin.js";
import * as service from "./notification.service.js";
import { requireOpsAdmin } from "../../middleware/requireRole.js";
import { generateNotificationAnalytics } from "./notification.analytics.js";
import { getNotificationObservability } from "./notification.observability.js";

export const notificationsRouter = Router();

/** SSE — Bearer or `access_token` query (must be registered before requireAuth). */
notificationsRouter.get(
  "/stream",
  asyncHandler(async (req, res) => {
    await openNotificationSse(req, res);
  }),
);

notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listNotificationsQuerySchema, req.query);
    const data = await service.listNotifications(req.user.id, query);
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const organizationId =
      typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
    const data = await service.getUnreadCount(req.user.id, organizationId);
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/history",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(historyQuerySchema, req.query);
    // History includes read + unread (same list with broader defaults).
    const data = await service.listNotifications(req.user.id, {
      eventType: query.eventType,
      organizationId: query.organizationId,
      limit: query.limit,
      offset: query.offset,
      unreadOnly: false,
    });
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/preferences",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.getPreferences(req.user.id);
    res.status(200).json(data);
  }),
);

notificationsRouter.put(
  "/preferences",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(updatePreferencesBodySchema, req.body);
    try {
      const data = await service.updatePreferences(
        req.user.id,
        body.preferences,
        body.emailDigestMode,
      );
      res.status(200).json(data);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(400, "INVALID_PREFERENCES", "Invalid notification preferences");
    }
  }),
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const organizationId =
      typeof req.body?.organizationId === "string" ? req.body.organizationId : undefined;
    const data = await service.markAllAsRead(req.user.id, organizationId);
    res.status(200).json(data);
  }),
);

/** ── Ops / analytics (requireOpsAdmin) ─────────────────────────── */
notificationsRouter.get(
  "/admin/overview",
  requireOpsAdmin,
  asyncHandler(async (_req, res) => {
    const data = await admin.getAdminOverview();
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/admin/analytics",
  requireOpsAdmin,
  asyncHandler(async (_req, res) => {
    const data = await generateNotificationAnalytics();
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/admin/observability",
  requireOpsAdmin,
  asyncHandler(async (_req, res) => {
    const data = await getNotificationObservability();
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/admin/queue",
  requireOpsAdmin,
  asyncHandler(async (_req, res) => {
    const analytics = await generateNotificationAnalytics();
    res.status(200).json({ queue: analytics.queue, retries: analytics.retries });
  }),
);

notificationsRouter.get(
  "/admin/delivery",
  requireOpsAdmin,
  asyncHandler(async (_req, res) => {
    const analytics = await generateNotificationAnalytics();
    res.status(200).json({
      delivery: analytics.delivery,
      channels: analytics.channels,
      digests: analytics.digests,
    });
  }),
);

notificationsRouter.get(
  "/admin/failures",
  requireOpsAdmin,
  asyncHandler(async (req, res) => {
    const query = parseQuery(adminListQuerySchema, req.query);
    const [analytics, deadLetters] = await Promise.all([
      generateNotificationAnalytics(),
      admin.listDeadLetters(query.limit, query.offset),
    ]);
    res.status(200).json({ failures: analytics.failures, deadLetters });
  }),
);

notificationsRouter.get(
  "/admin/outbox",
  requireOpsAdmin,
  asyncHandler(async (req, res) => {
    const query = parseQuery(adminOutboxStatusQuerySchema, req.query);
    const data = await admin.listOutboxByStatus(query.status, query.limit, query.offset);
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/admin/outbox/:id",
  requireOpsAdmin,
  asyncHandler(async (req, res) => {
    const params = parseParams(outboxIdParamsSchema, req.params);
    const data = await admin.inspectOutboxEntry(params.id);
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/admin/notifications/:id",
  requireOpsAdmin,
  asyncHandler(async (req, res) => {
    const params = parseParams(notificationIdParamsSchema, req.params);
    const data = await admin.inspectNotification(params.id);
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/admin/retention",
  requireOpsAdmin,
  asyncHandler(async (_req, res) => {
    const data = await admin.getRetentionPreview();
    res.status(200).json(data);
  }),
);

notificationsRouter.post(
  "/admin/retention/purge",
  requireOpsAdmin,
  asyncHandler(async (req, res) => {
    const body = parseBody(retentionPurgeBodySchema, req.body ?? {});
    const data = await admin.purgeExpiredRecords(body);
    res.status(200).json(data);
  }),
);

notificationsRouter.post(
  "/admin/dead-letters/retry",
  requireOpsAdmin,
  asyncHandler(async (req, res) => {
    const body = parseBody(retryDeadLettersBodySchema, req.body ?? {});
    const data = await admin.retryDeadLetters(body);
    res.status(200).json(data);
  }),
);

notificationsRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(notificationIdParamsSchema, req.params);
    const data = await service.getNotification(req.user.id, params.id);
    res.status(200).json(data);
  }),
);

notificationsRouter.post(
  "/:id/read",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(notificationIdParamsSchema, req.params);
    const data = await service.markAsRead(req.user.id, params.id);
    res.status(200).json(data);
  }),
);

notificationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(notificationIdParamsSchema, req.params);
    const data = await service.deleteNotification(req.user.id, params.id);
    res.status(200).json(data);
  }),
);
