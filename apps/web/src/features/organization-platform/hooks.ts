import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { organizationPlatformApi } from "../../services/organizationPlatformApi";

export function orgPlatformKeys() {
  return {
    all: ["organization-platform"] as const,
    dashboard: (organizationId?: string) =>
      ["organization-platform", "dashboard", organizationId] as const,
    hierarchy: (organizationId?: string) =>
      ["organization-platform", "hierarchy", organizationId] as const,
  };
}

export function useOrgPlatform(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgPlatformKeys().dashboard(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await organizationPlatformApi.get(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useOrgHierarchy(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: orgPlatformKeys().hierarchy(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await organizationPlatformApi.hierarchy(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateOrgDepartment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await organizationPlatformApi.createDepartment(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgPlatformKeys().all });
    },
  });
}

export function useCreateBusinessUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await organizationPlatformApi.createBusinessUnit(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgPlatformKeys().all });
    },
  });
}

export function useCreateOrgApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await organizationPlatformApi.createApproval(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: orgPlatformKeys().all });
    },
  });
}
