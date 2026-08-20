import { apiClient } from "./http";
import type {
  AdminAssignPermissionsInput,
  AdminAssignRoleInput,
  AdminAuditListResponse,
  AdminConfigurationResponse,
  AdminCreateFeatureFlagInput,
  AdminCreateTenantInput,
  AdminDashboardResponse,
  AdminFeatureFlag,
  AdminOrganizationListResponse,
  AdminPatchTenantInput,
  AdminPermissionsResponse,
  AdminRolesResponse,
  AdminTenantDetailResponse,
  AdminTenantListResponse,
  AdminTransferTenantInput,
  AdminUpdateConfigurationInput,
  AdminUpdateFeatureFlagInput,
  AdminUserListResponse,
  AdminHealthReport,
  AdminInspectionResponse,
  AdminConfigurationHistoryResponse,
  AdminAuditFilterParams,
  AdminCreatePolicyInput,
  AdminEvaluatePolicyInput,
  AdminEvaluatePolicyResponse,
  AdminPatchPolicyInput,
  AdminPolicyDetailResponse,
  AdminPolicyListResponse,
  AdminAnalyticsSummary,
  AdminTenantAnalytics,
  AdminPolicyAnalytics,
  AdminAuditAnalytics,
  AdminFeatureAnalytics,
  AdminOperationsReprocessInput,
  AdminOperationsCleanupInput,
  AdminOperationsReprocessResponse,
  AdminOperationsCleanupResponse,
} from "../types/api";

export const adminApi = {
  dashboard() {
    return apiClient.get<AdminDashboardResponse>("/admin/dashboard");
  },

  listUsers(params?: { search?: string; status?: string; limit?: number; offset?: number }) {
    return apiClient.get<AdminUserListResponse>("/admin/users", { params });
  },

  getUser(userId: string) {
    return apiClient.get(`/admin/users/${userId}`);
  },

  patchUser(userId: string, body: { firstName?: string | null; lastName?: string | null }) {
    return apiClient.patch<{ user: AdminUserListResponse["users"][number] }>(
      `/admin/users/${userId}`,
      body,
    );
  },

  suspendUser(userId: string, body?: { reason?: string }) {
    return apiClient.post<{ user: AdminUserListResponse["users"][number]; message: string }>(
      `/admin/users/${userId}/suspend`,
      body ?? {},
    );
  },

  restoreUser(userId: string, body?: { reason?: string }) {
    return apiClient.post<{ user: AdminUserListResponse["users"][number]; message: string }>(
      `/admin/users/${userId}/restore`,
      body ?? {},
    );
  },

  listOrganizations(params?: {
    search?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<AdminOrganizationListResponse>("/admin/organizations", { params });
  },

  getOrganization(organizationId: string) {
    return apiClient.get(`/admin/organizations/${organizationId}`);
  },

  patchOrganization(organizationId: string, body: { name?: string; slug?: string }) {
    return apiClient.patch<{ organization: AdminOrganizationListResponse["organizations"][number] }>(
      `/admin/organizations/${organizationId}`,
      body,
    );
  },

  suspendOrganization(organizationId: string, body?: { reason?: string }) {
    return apiClient.post<{
      organization: AdminOrganizationListResponse["organizations"][number];
      message: string;
    }>(`/admin/organizations/${organizationId}/suspend`, body ?? {});
  },

  restoreOrganization(organizationId: string, body?: { reason?: string }) {
    return apiClient.post<{
      organization: AdminOrganizationListResponse["organizations"][number];
      message: string;
    }>(`/admin/organizations/${organizationId}/restore`, body ?? {});
  },

  deleteOrganization(organizationId: string, body?: { reason?: string }) {
    return apiClient.post<{
      organization: AdminOrganizationListResponse["organizations"][number];
      message: string;
    }>(`/admin/organizations/${organizationId}/delete`, body ?? {});
  },

  listRoles() {
    return apiClient.get<AdminRolesResponse>("/admin/roles");
  },

  assignRole(body: AdminAssignRoleInput) {
    return apiClient.post<{ created: boolean }>("/admin/roles/assign", body);
  },

  revokeRole(body: AdminAssignRoleInput) {
    return apiClient.post<{ deleted: boolean }>("/admin/roles/revoke", body);
  },

  listPermissions() {
    return apiClient.get<AdminPermissionsResponse>("/admin/permissions");
  },

  assignPermissions(body: AdminAssignPermissionsInput) {
    return apiClient.put<AdminPermissionsResponse & { roleKey: string; capabilities: string[] }>(
      "/admin/permissions",
      body,
    );
  },

  getConfiguration() {
    return apiClient.get<AdminConfigurationResponse>("/admin/configuration");
  },

  updateConfiguration(body: AdminUpdateConfigurationInput) {
    return apiClient.patch<{ configuration: AdminConfigurationResponse["configurations"][number] }>(
      "/admin/configuration",
      body,
    );
  },

  listFeatureFlags(params?: { organizationId?: string }) {
    return apiClient.get<{ featureFlags: AdminFeatureFlag[] }>("/admin/feature-flags", {
      params,
    });
  },

  createFeatureFlag(body: AdminCreateFeatureFlagInput) {
    return apiClient.post<{ featureFlag: AdminFeatureFlag }>("/admin/feature-flags", body);
  },

  updateFeatureFlag(id: string, body: AdminUpdateFeatureFlagInput) {
    return apiClient.patch<{ featureFlag: AdminFeatureFlag }>(`/admin/feature-flags/${id}`, body);
  },

  listAudit(params?: AdminAuditFilterParams) {
    return apiClient.get<AdminAuditListResponse>("/admin/audit", {
      params: {
        ...params,
        success:
          params?.success === undefined ? undefined : params.success ? "true" : "false",
      },
    });
  },

  health() {
    return apiClient.get<AdminHealthReport>("/admin/health");
  },

  inspection() {
    return apiClient.get<AdminInspectionResponse>("/admin/inspection");
  },

  configurationHistory(params?: { key?: string; limit?: number; offset?: number }) {
    return apiClient.get<AdminConfigurationHistoryResponse>("/admin/configuration/history", {
      params,
    });
  },

  configurationRollback(body: { key: string; auditId: string }) {
    return apiClient.post<{
      configuration: AdminConfigurationResponse["configurations"][number];
      rolledBackFromAuditId: string;
      restoredValue: unknown;
    }>("/admin/configuration/rollback", body);
  },

  listTenants(params?: { search?: string; status?: string; limit?: number; offset?: number }) {
    return apiClient.get<AdminTenantListResponse>("/admin/tenants", { params });
  },

  getTenant(tenantId: string) {
    return apiClient.get<AdminTenantDetailResponse>(`/admin/tenants/${tenantId}`);
  },

  createTenant(body: AdminCreateTenantInput) {
    return apiClient.post<{
      tenant: AdminTenantDetailResponse["tenant"];
      quotas: import("../types/api").TenantQuotaView;
    }>("/admin/tenants", body);
  },

  patchTenant(tenantId: string, body: AdminPatchTenantInput) {
    return apiClient.patch<{
      tenant: AdminTenantDetailResponse["tenant"];
      quotas: import("../types/api").TenantQuotaView;
    }>(`/admin/tenants/${tenantId}`, body);
  },

  suspendTenant(tenantId: string, body?: { reason?: string }) {
    return apiClient.post<{ tenant: AdminTenantDetailResponse["tenant"] }>(
      `/admin/tenants/${tenantId}/suspend`,
      body ?? {},
    );
  },

  restoreTenant(tenantId: string, body?: { reason?: string }) {
    return apiClient.post<{ tenant: AdminTenantDetailResponse["tenant"] }>(
      `/admin/tenants/${tenantId}/restore`,
      body ?? {},
    );
  },

  archiveTenant(tenantId: string, body?: { reason?: string }) {
    return apiClient.post<{ tenant: AdminTenantDetailResponse["tenant"] }>(
      `/admin/tenants/${tenantId}/archive`,
      body ?? {},
    );
  },

  transferTenant(tenantId: string, body: AdminTransferTenantInput) {
    return apiClient.post<{
      tenant: AdminTenantDetailResponse["tenant"];
      transferredToUserId: string;
    }>(`/admin/tenants/${tenantId}/transfer`, body);
  },

  listPolicies(params?: {
    policyType?: string;
    status?: string;
    organizationId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    return apiClient.get<AdminPolicyListResponse>("/admin/policies", { params });
  },

  getPolicy(policyId: string) {
    return apiClient.get<AdminPolicyDetailResponse>(`/admin/policies/${policyId}`);
  },

  createPolicy(body: AdminCreatePolicyInput) {
    return apiClient.post<{ policy: AdminPolicyListResponse["policies"][number] }>(
      "/admin/policies",
      body,
    );
  },

  patchPolicy(policyId: string, body: AdminPatchPolicyInput) {
    return apiClient.patch<{ policy: AdminPolicyListResponse["policies"][number] }>(
      `/admin/policies/${policyId}`,
      body,
    );
  },

  deletePolicy(policyId: string) {
    return apiClient.delete<{ deleted: boolean; policyId: string }>(
      `/admin/policies/${policyId}`,
    );
  },

  evaluatePolicies(body: AdminEvaluatePolicyInput) {
    return apiClient.post<AdminEvaluatePolicyResponse>("/admin/policies/evaluate", body);
  },

  analytics(params?: { days?: number }) {
    return apiClient.get<AdminAnalyticsSummary>("/admin/analytics", { params });
  },

  analyticsTenants(params?: { days?: number }) {
    return apiClient.get<AdminTenantAnalytics>("/admin/analytics/tenants", { params });
  },

  analyticsPolicies() {
    return apiClient.get<AdminPolicyAnalytics>("/admin/analytics/policies");
  },

  analyticsAudit() {
    return apiClient.get<AdminAuditAnalytics>("/admin/analytics/audit");
  },

  analyticsFeatures() {
    return apiClient.get<AdminFeatureAnalytics>("/admin/analytics/features");
  },

  operationsReprocess(body: AdminOperationsReprocessInput) {
    return apiClient.post<AdminOperationsReprocessResponse>("/admin/operations/reprocess", body);
  },

  operationsCleanup(body: AdminOperationsCleanupInput) {
    return apiClient.post<AdminOperationsCleanupResponse>("/admin/operations/cleanup", body);
  },
};
