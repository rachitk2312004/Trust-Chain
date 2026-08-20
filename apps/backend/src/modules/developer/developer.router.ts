import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import {
  analyticsQuerySchema,
  auditQuerySchema,
  createKeyBodySchema,
  createServiceAccountBodySchema,
  createWebhookBodySchema,
  deliveryIdParamsSchema,
  developerDashboardQuerySchema,
  keyIdParamsSchema,
  listDeliveriesQuerySchema,
  listKeysQuerySchema,
  listServiceAccountsQuerySchema,
  listWebhooksQuerySchema,
  patchKeyBodySchema,
  patchQuotaBodySchema,
  patchServiceAccountBodySchema,
  patchWebhookBodySchema,
  quotaIdParamsSchema,
  replayWebhookBodySchema,
  serviceAccountIdParamsSchema,
  testWebhookBodySchema,
  usageQuerySchema,
  webhookIdParamsSchema,
} from "./developer.schemas.js";
import * as service from "./developer.service.js";

export const developerRouter = Router();

developerRouter.use(requireAuth);

developerRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(developerDashboardQuerySchema, req.query);
    const data = await service.getDeveloperDashboard(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getDeveloperAnalytics(
      req.user.id,
      query.organizationId,
      query.days,
    );
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/analytics/usage",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getDeveloperAnalyticsUsage(
      req.user.id,
      query.organizationId,
      query.days,
    );
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/analytics/errors",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getDeveloperAnalyticsErrors(
      req.user.id,
      query.organizationId,
      query.days,
    );
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/analytics/latency",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await service.getDeveloperAnalyticsLatency(
      req.user.id,
      query.organizationId,
      query.days,
    );
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/quotas",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(developerDashboardQuerySchema, req.query);
    const data = await service.listDeveloperQuotas(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

developerRouter.patch(
  "/quotas/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(quotaIdParamsSchema, req.params);
    const body = parseBody(patchQuotaBodySchema, req.body);
    const data = await service.patchDeveloperQuota(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/audit",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(auditQuerySchema, req.query);
    const data = await service.searchDeveloperAuditLogs(req.user.id, query);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/usage",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(usageQuerySchema, req.query);
    const data = await service.getPublicApiUsage(req.user.id, query.organizationId, query);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/sdk",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(developerDashboardQuerySchema, req.query);
    const data = await service.getDeveloperSdkMetadata(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/openapi.json",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(developerDashboardQuerySchema, req.query);
    const body = await service.getOpenApiJson(req.user.id, query.organizationId);
    res.status(200).json(body);
  }),
);

developerRouter.get(
  "/openapi.yaml",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(developerDashboardQuerySchema, req.query);
    const body = await service.getOpenApiYaml(req.user.id, query.organizationId);
    res.status(200).type("text/yaml").send(body);
  }),
);

developerRouter.get(
  "/keys",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listKeysQuerySchema, req.query);
    const data = await service.listApiKeys(req.user.id, query);
    res.status(200).json(data);
  }),
);

developerRouter.post(
  "/keys",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createKeyBodySchema, req.body);
    const data = await service.createApiKey(req.user.id, body);
    res.status(201).json(data);
  }),
);

developerRouter.patch(
  "/keys/:keyId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(keyIdParamsSchema, req.params);
    const body = parseBody(patchKeyBodySchema, req.body);
    const data = await service.patchApiKey(req.user.id, params.keyId, body);
    res.status(200).json(data);
  }),
);

developerRouter.delete(
  "/keys/:keyId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(keyIdParamsSchema, req.params);
    const data = await service.deleteApiKey(req.user.id, params.keyId);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/webhooks",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listWebhooksQuerySchema, req.query);
    const data = await service.listWebhooks(req.user.id, query);
    res.status(200).json(data);
  }),
);

developerRouter.post(
  "/webhooks",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createWebhookBodySchema, req.body);
    const data = await service.createWebhook(req.user.id, body);
    res.status(201).json(data);
  }),
);

developerRouter.get(
  "/webhooks/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(webhookIdParamsSchema, req.params);
    const data = await service.getWebhookDetail(req.user.id, params.id);
    res.status(200).json(data);
  }),
);

developerRouter.patch(
  "/webhooks/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(webhookIdParamsSchema, req.params);
    const body = parseBody(patchWebhookBodySchema, req.body);
    const data = await service.patchWebhook(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

developerRouter.delete(
  "/webhooks/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(webhookIdParamsSchema, req.params);
    const data = await service.deleteWebhook(req.user.id, params.id);
    res.status(200).json(data);
  }),
);

developerRouter.post(
  "/webhooks/:id/test",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(webhookIdParamsSchema, req.params);
    const body = parseBody(testWebhookBodySchema, req.body ?? {});
    const data = await service.testWebhook(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

developerRouter.post(
  "/webhooks/:id/replay",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(webhookIdParamsSchema, req.params);
    const body = parseBody(replayWebhookBodySchema, req.body);
    const data = await service.replayWebhookDelivery(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/webhooks/:id/deliveries",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(webhookIdParamsSchema, req.params);
    const query = parseQuery(listDeliveriesQuerySchema, req.query);
    const data = await service.listWebhookDeliveries(req.user.id, params.id, query);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/webhooks/:id/deliveries/:deliveryId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(deliveryIdParamsSchema, req.params);
    const data = await service.getWebhookDelivery(req.user.id, params.id, params.deliveryId);
    res.status(200).json(data);
  }),
);

developerRouter.get(
  "/service-accounts",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listServiceAccountsQuerySchema, req.query);
    const data = await service.listServiceAccounts(req.user.id, query);
    res.status(200).json(data);
  }),
);

developerRouter.post(
  "/service-accounts",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createServiceAccountBodySchema, req.body);
    const data = await service.createServiceAccount(req.user.id, body);
    res.status(201).json(data);
  }),
);

developerRouter.patch(
  "/service-accounts/:serviceAccountId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(serviceAccountIdParamsSchema, req.params);
    const body = parseBody(patchServiceAccountBodySchema, req.body);
    const data = await service.patchServiceAccount(
      req.user.id,
      params.serviceAccountId,
      body,
    );
    res.status(200).json(data);
  }),
);
