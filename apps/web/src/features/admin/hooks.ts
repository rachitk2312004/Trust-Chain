import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { adminApi } from "../../services/adminApi";
import type {
  AdminAssignPermissionsInput,
  AdminAssignRoleInput,
  AdminAuditFilterParams,
  AdminCreateFeatureFlagInput,
  AdminCreateTenantInput,
  AdminPatchTenantInput,
  AdminTransferTenantInput,
  AdminUpdateConfigurationInput,
  AdminUpdateFeatureFlagInput,
  AdminCreatePolicyInput,
  AdminEvaluatePolicyInput,
  AdminPatchPolicyInput,
  AdminOperationsCleanupInput,
  AdminOperationsReprocessInput,
} from "../../types/api";

export function adminKeys() {
  return {
    all: ["admin"] as const,
    dashboard: ["admin", "dashboard"] as const,
    users: (filters?: { search?: string; status?: string }) =>
      ["admin", "users", filters ?? {}] as const,
    organizations: (filters?: { search?: string; status?: string }) =>
      ["admin", "organizations", filters ?? {}] as const,
    tenants: (filters?: { search?: string; status?: string }) =>
      ["admin", "tenants", filters ?? {}] as const,
    tenantDetail: (tenantId?: string) => ["admin", "tenants", tenantId] as const,
    roles: ["admin", "roles"] as const,
    permissions: ["admin", "permissions"] as const,
    configuration: ["admin", "configuration"] as const,
    featureFlags: ["admin", "feature-flags"] as const,
    audit: (filters?: Record<string, unknown>) => ["admin", "audit", filters ?? {}] as const,
    health: ["admin", "health"] as const,
    inspection: ["admin", "inspection"] as const,
    configurationHistory: (filters?: { key?: string }) =>
      ["admin", "configuration-history", filters ?? {}] as const,
    policies: (filters?: Record<string, unknown>) => ["admin", "policies", filters ?? {}] as const,
    policyDetail: (policyId?: string) => ["admin", "policies", policyId] as const,
    analytics: (days?: number) => ["admin", "analytics", days ?? 30] as const,
    analyticsTenants: (days?: number) => ["admin", "analytics", "tenants", days ?? 30] as const,
    analyticsPolicies: ["admin", "analytics", "policies"] as const,
    analyticsAudit: ["admin", "analytics", "audit"] as const,
    analyticsFeatures: ["admin", "analytics", "features"] as const,
  };
}

export function useAdminDashboard(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().dashboard,
    queryFn: async () => {
      const { data } = await adminApi.dashboard();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 30_000,
  });
}

export function useAdminUsers(
  filters?: { search?: string; status?: string; limit?: number },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().users({ search: filters?.search, status: filters?.status }),
    queryFn: async () => {
      const { data } = await adminApi.listUsers({
        search: filters?.search || undefined,
        status: filters?.status || undefined,
        limit: filters?.limit ?? 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAdminOrganizations(
  filters?: { search?: string; status?: string; limit?: number },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().organizations({ search: filters?.search, status: filters?.status }),
    queryFn: async () => {
      const { data } = await adminApi.listOrganizations({
        search: filters?.search || undefined,
        status: filters?.status || undefined,
        limit: filters?.limit ?? 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useSuspendAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; reason?: string }) => {
      const { data } = await adminApi.suspendUser(input.userId, { reason: input.reason });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().users() });
    },
  });
}

export function useRestoreAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; reason?: string }) => {
      const { data } = await adminApi.restoreUser(input.userId, { reason: input.reason });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().users() });
    },
  });
}

export function usePatchAdminUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      userId: string;
      body: { firstName?: string | null; lastName?: string | null };
    }) => {
      const { data } = await adminApi.patchUser(input.userId, input.body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().users() });
    },
  });
}

export function usePatchAdminOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organizationId: string; body: { name?: string; slug?: string } }) => {
      const { data } = await adminApi.patchOrganization(input.organizationId, input.body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().organizations() });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useSuspendAdminOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organizationId: string; reason?: string }) => {
      const { data } = await adminApi.suspendOrganization(input.organizationId, {
        reason: input.reason,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().organizations() });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useRestoreAdminOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organizationId: string; reason?: string }) => {
      const { data } = await adminApi.restoreOrganization(input.organizationId, {
        reason: input.reason,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().organizations() });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useDeleteAdminOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { organizationId: string; reason?: string }) => {
      const { data } = await adminApi.deleteOrganization(input.organizationId, {
        reason: input.reason,
      });
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().organizations() });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useAdminRoles(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().roles,
    queryFn: async () => {
      const { data } = await adminApi.listRoles();
      return data.roles;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAdminPermissions(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().permissions,
    queryFn: async () => {
      const { data } = await adminApi.listPermissions();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAdminConfiguration(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().configuration,
    queryFn: async () => {
      const { data } = await adminApi.getConfiguration();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAdminFeatureFlags(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().featureFlags,
    queryFn: async () => {
      const { data } = await adminApi.listFeatureFlags();
      return data.featureFlags;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAdminAudit(filters?: AdminAuditFilterParams, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().audit(filters as Record<string, unknown> | undefined),
    queryFn: async () => {
      const { data } = await adminApi.listAudit({
        ...filters,
        limit: filters?.limit ?? 50,
      });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAssignAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminAssignRoleInput) => {
      const { data } = await adminApi.assignRole(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().all });
    },
  });
}

export function useRevokeAdminRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminAssignRoleInput) => {
      const { data } = await adminApi.revokeRole(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().all });
    },
  });
}

export function useAssignAdminPermissions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminAssignPermissionsInput) => {
      const { data } = await adminApi.assignPermissions(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().permissions });
      void queryClient.invalidateQueries({ queryKey: adminKeys().configuration });
    },
  });
}

export function useUpdateAdminConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminUpdateConfigurationInput) => {
      const { data } = await adminApi.updateConfiguration(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().configuration });
    },
  });
}

export function useCreateAdminFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminCreateFeatureFlagInput) => {
      const { data } = await adminApi.createFeatureFlag(input);
      return data.featureFlag;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().featureFlags });
      void queryClient.invalidateQueries({ queryKey: adminKeys().dashboard });
    },
  });
}

export function useUpdateAdminFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & AdminUpdateFeatureFlagInput) => {
      const { id, ...body } = input;
      const { data } = await adminApi.updateFeatureFlag(id, body);
      return data.featureFlag;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().featureFlags });
    },
  });
}

export function useAdminTenants(
  filters?: { search?: string; status?: string; limit?: number },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().tenants({ search: filters?.search, status: filters?.status }),
    queryFn: async () => {
      const { data } = await adminApi.listTenants({
        search: filters?.search || undefined,
        status: filters?.status || undefined,
        limit: filters?.limit ?? 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAdminTenant(tenantId: string | undefined, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().tenantDetail(tenantId),
    queryFn: async () => {
      const { data } = await adminApi.getTenant(tenantId!);
      return data;
    },
    enabled: Boolean(accessToken && enabled && tenantId),
  });
}

export function useCreateAdminTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminCreateTenantInput) => {
      const { data } = await adminApi.createTenant(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().all });
    },
  });
}

export function usePatchAdminTenant(tenantId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminPatchTenantInput) => {
      const { data } = await adminApi.patchTenant(tenantId, input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenantDetail(tenantId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useSuspendAdminTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenantId: string; reason?: string }) => {
      const { data } = await adminApi.suspendTenant(input.tenantId, { reason: input.reason });
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenantDetail(vars.tenantId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useRestoreAdminTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenantId: string; reason?: string }) => {
      const { data } = await adminApi.restoreTenant(input.tenantId, { reason: input.reason });
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenantDetail(vars.tenantId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useArchiveAdminTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenantId: string; reason?: string }) => {
      const { data } = await adminApi.archiveTenant(input.tenantId, { reason: input.reason });
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenantDetail(vars.tenantId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useTransferAdminTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { tenantId: string } & AdminTransferTenantInput) => {
      const { tenantId, ...body } = input;
      const { data } = await adminApi.transferTenant(tenantId, body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenantDetail(vars.tenantId) });
      void queryClient.invalidateQueries({ queryKey: adminKeys().tenants() });
    },
  });
}

export function useAdminHealth(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().health,
    queryFn: async () => {
      const { data } = await adminApi.health();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 15_000,
  });
}

export function useAdminInspection(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().inspection,
    queryFn: async () => {
      const { data } = await adminApi.inspection();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 30_000,
  });
}

export function useAdminConfigurationHistory(
  filters?: { key?: string; limit?: number },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().configurationHistory({ key: filters?.key }),
    queryFn: async () => {
      const { data } = await adminApi.configurationHistory({
        key: filters?.key || undefined,
        limit: filters?.limit ?? 50,
      });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useRollbackAdminConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; auditId: string }) => {
      const { data } = await adminApi.configurationRollback(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: adminKeys().configuration });
      void queryClient.invalidateQueries({
        queryKey: ["admin", "configuration-history"],
      });
      void queryClient.invalidateQueries({ queryKey: adminKeys().audit() });
    },
  });
}

export function useAdminPolicies(
  filters?: {
    policyType?: string;
    status?: string;
    organizationId?: string;
    search?: string;
    limit?: number;
  },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().policies({
      policyType: filters?.policyType,
      status: filters?.status,
      organizationId: filters?.organizationId,
      search: filters?.search,
    }),
    queryFn: async () => {
      const { data } = await adminApi.listPolicies({
        policyType: filters?.policyType || undefined,
        status: filters?.status || undefined,
        organizationId: filters?.organizationId || undefined,
        search: filters?.search || undefined,
        limit: filters?.limit ?? 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useAdminPolicy(policyId?: string, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().policyDetail(policyId),
    queryFn: async () => {
      const { data } = await adminApi.getPolicy(policyId!);
      return data;
    },
    enabled: Boolean(accessToken && enabled && policyId),
  });
}

export function useCreateAdminPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminCreatePolicyInput) => {
      const { data } = await adminApi.createPolicy(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
    },
  });
}

export function usePatchAdminPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { policyId: string; body: AdminPatchPolicyInput }) => {
      const { data } = await adminApi.patchPolicy(input.policyId, input.body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
      void queryClient.invalidateQueries({
        queryKey: adminKeys().policyDetail(vars.policyId),
      });
    },
  });
}

export function useDeleteAdminPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (policyId: string) => {
      const { data } = await adminApi.deletePolicy(policyId);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
    },
  });
}

export function useEvaluateAdminPolicies() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminEvaluatePolicyInput) => {
      const { data } = await adminApi.evaluatePolicies(input);
      return data;
    },
    onSuccess: (_data, vars) => {
      if (vars.organizationId) {
        void queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
      }
    },
  });
}

export function useAdminAnalytics(days = 30, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().analytics(days),
    queryFn: async () => {
      const { data } = await adminApi.analytics({ days });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 30_000,
  });
}

export function useAdminTenantAnalytics(days = 30, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().analyticsTenants(days),
    queryFn: async () => {
      const { data } = await adminApi.analyticsTenants({ days });
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 30_000,
  });
}

export function useAdminPolicyAnalytics(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().analyticsPolicies,
    queryFn: async () => {
      const { data } = await adminApi.analyticsPolicies();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 30_000,
  });
}

export function useAdminAuditAnalytics(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().analyticsAudit,
    queryFn: async () => {
      const { data } = await adminApi.analyticsAudit();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 30_000,
  });
}

export function useAdminFeatureAnalytics(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: adminKeys().analyticsFeatures,
    queryFn: async () => {
      const { data } = await adminApi.analyticsFeatures();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 30_000,
  });
}

export function useAdminOperationsReprocess() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminOperationsReprocessInput) => {
      const { data } = await adminApi.operationsReprocess(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tenants"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "policies"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys().configuration });
    },
  });
}

export function useAdminOperationsCleanup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AdminOperationsCleanupInput) => {
      const { data } = await adminApi.operationsCleanup(input);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
      void queryClient.invalidateQueries({ queryKey: adminKeys().audit() });
    },
  });
}
