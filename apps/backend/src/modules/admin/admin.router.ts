import { Router } from "express";
import { RoleKeys } from "@trustchain/config";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { AppError } from "../../lib/errors.js";
import { parseBody, parseParams, parseQuery } from "../../lib/validate.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireRole } from "../../middleware/requireRole.js";
import {
  assignPermissionsBodySchema,
  assignRoleBodySchema,
  adminReasonBodySchema,
  configurationHistoryQuerySchema,
  configurationRollbackBodySchema,
  createFeatureFlagBodySchema,
  featureFlagIdParamsSchema,
  listAuditQuerySchema,
  listFeatureFlagsQuerySchema,
  listOrganizationsQuerySchema,
  listUsersQuerySchema,
  operationsCleanupBodySchema,
  operationsReprocessBodySchema,
  analyticsQuerySchema,
  organizationIdParamsSchema,
  patchAdminOrganizationBodySchema,
  patchAdminUserBodySchema,
  patchFeatureFlagBodySchema,
  revokeRoleBodySchema,
  updateConfigurationBodySchema,
  userIdParamsSchema,
} from "./admin.schemas.js";
import {
  createTenantBodySchema,
  listTenantsQuerySchema,
  patchTenantBodySchema,
  tenantIdParamsSchema,
  tenantReasonBodySchema,
  transferTenantBodySchema,
} from "./admin.tenants.schemas.js";
import * as service from "./admin.service.js";
import * as tenants from "./admin.tenants.js";
import { getAdminHealth } from "./admin.health.js";
import { getAdminInspection } from "./admin.inspection.js";
import {
  listConfigurationHistory,
  rollbackConfiguration,
} from "./admin.configuration.js";
import {
  createPolicyBodySchema,
  evaluatePolicyBodySchema,
  listPoliciesQuerySchema,
  patchPolicyBodySchema,
  policyIdParamsSchema,
} from "./admin.policy.schemas.js";
import * as policies from "./admin.policy.js";
import {
  getAdminAnalytics,
  getAdminAuditAnalytics,
  getAdminFeatureAnalytics,
  getAdminPolicyAnalytics,
  getAdminTenantAnalytics,
} from "./admin.analytics.js";
import {
  runAdminOperationsCleanup,
  runAdminOperationsReprocess,
} from "./admin.operations.js";

export const adminRouter = Router();

adminRouter.use(requireAuth);
adminRouter.use(requireRole([RoleKeys.superAdmin]));

adminRouter.get(
  "/dashboard",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.getAdminDashboard(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/tenants",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listTenantsQuerySchema, req.query);
    const data = await tenants.listTenants(req.user.id, query);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/tenants",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createTenantBodySchema, req.body);
    const data = await tenants.createTenant(req.user.id, body);
    res.status(201).json(data);
  }),
);

adminRouter.get(
  "/tenants/:tenantId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(tenantIdParamsSchema, req.params);
    const data = await tenants.getTenant(req.user.id, params.tenantId);
    res.status(200).json(data);
  }),
);

adminRouter.patch(
  "/tenants/:tenantId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(tenantIdParamsSchema, req.params);
    const body = parseBody(patchTenantBodySchema, req.body);
    const data = await tenants.patchTenant(req.user.id, params.tenantId, body);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/tenants/:tenantId/suspend",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(tenantIdParamsSchema, req.params);
    const body = parseBody(tenantReasonBodySchema, req.body ?? {});
    const data = await tenants.suspendTenant(req.user.id, params.tenantId, body.reason);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/tenants/:tenantId/restore",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(tenantIdParamsSchema, req.params);
    const body = parseBody(tenantReasonBodySchema, req.body ?? {});
    const data = await tenants.restoreTenant(req.user.id, params.tenantId, body.reason);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/tenants/:tenantId/archive",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(tenantIdParamsSchema, req.params);
    const body = parseBody(tenantReasonBodySchema, req.body ?? {});
    const data = await tenants.archiveTenant(req.user.id, params.tenantId, body.reason);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/tenants/:tenantId/transfer",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(tenantIdParamsSchema, req.params);
    const body = parseBody(transferTenantBodySchema, req.body);
    const data = await tenants.transferTenant(req.user.id, params.tenantId, body);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/users",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listUsersQuerySchema, req.query);
    const data = await service.listAdminUsers(req.user.id, query);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/users/:userId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(userIdParamsSchema, req.params);
    const data = await service.inspectAdminUser(req.user.id, params.userId);
    res.status(200).json(data);
  }),
);

adminRouter.patch(
  "/users/:userId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(userIdParamsSchema, req.params);
    const body = parseBody(patchAdminUserBodySchema, req.body);
    const data = await service.patchAdminUser(req.user.id, params.userId, body);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/users/:userId/suspend",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(userIdParamsSchema, req.params);
    const body = parseBody(adminReasonBodySchema, req.body ?? {});
    const data = await service.suspendAdminUser(req.user.id, params.userId, body.reason);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/users/:userId/restore",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(userIdParamsSchema, req.params);
    const body = parseBody(adminReasonBodySchema, req.body ?? {});
    const data = await service.restoreAdminUser(req.user.id, params.userId, body.reason);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/organizations",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listOrganizationsQuerySchema, req.query);
    const data = await service.listAdminOrganizations(req.user.id, query);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/organizations/:organizationId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const data = await service.inspectAdminOrganization(req.user.id, params.organizationId);
    res.status(200).json(data);
  }),
);

adminRouter.patch(
  "/organizations/:organizationId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(patchAdminOrganizationBodySchema, req.body);
    const data = await service.patchAdminOrganization(req.user.id, params.organizationId, body);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/organizations/:organizationId/suspend",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(adminReasonBodySchema, req.body ?? {});
    const data = await service.suspendAdminOrganization(
      req.user.id,
      params.organizationId,
      body.reason,
    );
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/organizations/:organizationId/restore",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(adminReasonBodySchema, req.body ?? {});
    const data = await service.restoreAdminOrganization(
      req.user.id,
      params.organizationId,
      body.reason,
    );
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/organizations/:organizationId/delete",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(organizationIdParamsSchema, req.params);
    const body = parseBody(adminReasonBodySchema, req.body ?? {});
    const data = await service.deleteAdminOrganization(
      req.user.id,
      params.organizationId,
      body.reason,
    );
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/roles",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.listAdminRoles(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/roles/assign",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(assignRoleBodySchema, req.body);
    const data = await service.assignAdminRole(req.user.id, body);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/roles/revoke",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(revokeRoleBodySchema, req.body);
    const data = await service.revokeAdminRole(req.user.id, body);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/permissions",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.listAdminPermissions(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.put(
  "/permissions",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(assignPermissionsBodySchema, req.body);
    const data = await service.assignRolePermissions(req.user.id, body);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/configuration",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await service.getAdminConfiguration(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/configuration/history",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(configurationHistoryQuerySchema, req.query);
    const data = await listConfigurationHistory(req.user.id, query);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/configuration/rollback",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(configurationRollbackBodySchema, req.body);
    const data = await rollbackConfiguration(req.user.id, body);
    res.status(200).json(data);
  }),
);

adminRouter.patch(
  "/configuration",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(updateConfigurationBodySchema, req.body);
    const data = await service.updateAdminConfiguration(req.user.id, {
      key: body.key,
      value: body.value as unknown,
      description: body.description,
    });
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/health",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await getAdminHealth(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/inspection",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await getAdminInspection(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/policies",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listPoliciesQuerySchema, req.query);
    const data = await policies.listPolicies(req.user.id, query);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/policies",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createPolicyBodySchema, req.body);
    const data = await policies.createPolicy(req.user.id, body);
    res.status(201).json(data);
  }),
);

adminRouter.post(
  "/policies/evaluate",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(evaluatePolicyBodySchema, req.body);
    const data = await policies.evaluateAdminPolicies(req.user.id, body);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/policies/:policyId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(policyIdParamsSchema, req.params);
    const data = await policies.getPolicy(req.user.id, params.policyId);
    res.status(200).json(data);
  }),
);

adminRouter.patch(
  "/policies/:policyId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(policyIdParamsSchema, req.params);
    const body = parseBody(patchPolicyBodySchema, req.body);
    const data = await policies.patchPolicy(req.user.id, params.policyId, body);
    res.status(200).json(data);
  }),
);

adminRouter.delete(
  "/policies/:policyId",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(policyIdParamsSchema, req.params);
    const data = await policies.deletePolicy(req.user.id, params.policyId);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/feature-flags",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listFeatureFlagsQuerySchema, req.query);
    const data = await service.listAdminFeatureFlags(req.user.id, query.organizationId);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/feature-flags",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(createFeatureFlagBodySchema, req.body);
    const data = await service.createAdminFeatureFlag(req.user.id, body);
    res.status(201).json(data);
  }),
);

adminRouter.patch(
  "/feature-flags/:id",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const params = parseParams(featureFlagIdParamsSchema, req.params);
    const body = parseBody(patchFeatureFlagBodySchema, req.body);
    const data = await service.updateAdminFeatureFlag(req.user.id, params.id, body);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/audit",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(listAuditQuerySchema, req.query);
    const data = await service.listAdminAuditLogs(req.user.id, query);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/analytics",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await getAdminAnalytics(req.user.id, { days: query.days });
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/analytics/tenants",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const query = parseQuery(analyticsQuerySchema, req.query);
    const data = await getAdminTenantAnalytics(req.user.id, { days: query.days });
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/analytics/policies",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await getAdminPolicyAnalytics(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/analytics/audit",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await getAdminAuditAnalytics(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.get(
  "/analytics/features",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const data = await getAdminFeatureAnalytics(req.user.id);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/operations/reprocess",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(operationsReprocessBodySchema, req.body);
    const data = await runAdminOperationsReprocess(req.user.id, body);
    res.status(200).json(data);
  }),
);

adminRouter.post(
  "/operations/cleanup",
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError(401, "UNAUTHORIZED", "Unauthorized");
    const body = parseBody(operationsCleanupBodySchema, req.body);
    const data = await runAdminOperationsCleanup(req.user.id, body);
    res.status(200).json(data);
  }),
);
