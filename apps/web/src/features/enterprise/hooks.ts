import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { enterpriseApi } from "../../services/enterpriseApi";

export function enterpriseKeys() {
  return {
    all: ["enterprise"] as const,
    dashboard: (organizationId?: string) => ["enterprise", "dashboard", organizationId] as const,
    roles: (organizationId?: string) => ["enterprise", "roles", organizationId] as const,
  };
}

export function useEnterpriseDashboard(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: enterpriseKeys().dashboard(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await enterpriseApi.get(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useEnterpriseRoles(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: enterpriseKeys().roles(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await enterpriseApi.listRoles({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useUpsertSaml() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await enterpriseApi.upsertSaml(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: enterpriseKeys().all });
    },
  });
}

export function useUpsertScim() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await enterpriseApi.upsertScim(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: enterpriseKeys().all });
    },
  });
}

export function useCreateEnterpriseRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await enterpriseApi.createRole(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: enterpriseKeys().all });
    },
  });
}

export function usePatchEnterpriseRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: Record<string, unknown> }) => {
      const { data } = await enterpriseApi.patchRole(input.id, input.body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: enterpriseKeys().all });
    },
  });
}
