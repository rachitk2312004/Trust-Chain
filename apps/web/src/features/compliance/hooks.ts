import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { complianceApi } from "../../services/complianceApi";

export function complianceKeys() {
  return {
    all: ["compliance"] as const,
    dashboard: (organizationId?: string) =>
      ["compliance", "dashboard", organizationId] as const,
    reports: (organizationId?: string) => ["compliance", "reports", organizationId] as const,
    assessment: (id?: string) => ["compliance", "assessment", id] as const,
  };
}

export function useComplianceDashboard(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: complianceKeys().dashboard(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await complianceApi.dashboard(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
    staleTime: 15_000,
  });
}

export function useComplianceReports(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: complianceKeys().reports(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await complianceApi.reports({
        organizationId: organizationId!,
        limit: 50,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useRunCompliance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organizationId: string;
      framework: string;
      signals?: Record<string, number>;
    }) => {
      const { data } = await complianceApi.run(input);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: complianceKeys().dashboard(vars.organizationId),
      });
      void queryClient.invalidateQueries({
        queryKey: complianceKeys().reports(vars.organizationId),
      });
    },
  });
}

export function useCompleteRemediation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; organizationId: string }) => {
      const { data } = await complianceApi.patchRemediation(input.id, {
        status: "completed",
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: complianceKeys().dashboard(vars.organizationId),
      });
    },
  });
}
