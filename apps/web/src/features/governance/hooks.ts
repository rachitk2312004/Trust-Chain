import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { governanceApi } from "../../services/governanceApi";

export function governanceKeys() {
  return {
    all: ["governance"] as const,
    dashboard: (organizationId?: string) => ["governance", "dashboard", organizationId] as const,
    risks: (organizationId?: string) => ["governance", "risks", organizationId] as const,
    reports: (organizationId?: string) => ["governance", "reports", organizationId] as const,
  };
}

export function useGovernanceDashboard(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: governanceKeys().dashboard(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await governanceApi.dashboard(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useGovernanceRisks(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: governanceKeys().risks(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await governanceApi.listRisks({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useGovernanceReports(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: governanceKeys().reports(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await governanceApi.reports(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateGovernancePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await governanceApi.createPolicy(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: governanceKeys().all });
    },
  });
}

export function usePatchGovernancePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await governanceApi.patchPolicy(id, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: governanceKeys().all });
    },
  });
}

export function useCreateGovernanceRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await governanceApi.createRisk(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: governanceKeys().all });
    },
  });
}

export function usePatchGovernanceRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await governanceApi.patchRisk(id, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: governanceKeys().all });
    },
  });
}
