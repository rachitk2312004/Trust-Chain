import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { recoveryApi } from "../../services/recoveryApi";

export function recoveryKeys() {
  return {
    all: ["recovery"] as const,
    dashboard: (organizationId?: string) => ["recovery", "dashboard", organizationId] as const,
    status: (organizationId?: string) => ["recovery", "status", organizationId] as const,
    reports: (organizationId?: string) => ["recovery", "reports", organizationId] as const,
  };
}

export function useRecoveryDashboard(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: recoveryKeys().dashboard(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await recoveryApi.dashboard(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useRecoveryStatus(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: recoveryKeys().status(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await recoveryApi.status(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useRecoveryReports(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: recoveryKeys().reports(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await recoveryApi.reports(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await recoveryApi.createBackup(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recoveryKeys().all });
    },
  });
}

export function useCreateRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      organizationId: string;
      backupJobId: string;
      targetRegionCode: string;
    }) => {
      const { data } = await recoveryApi.createRestore(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recoveryKeys().all });
    },
  });
}

export function useCreateFailback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      organizationId: string;
      fromRegionCode: string;
      toRegionCode: string;
      reason: string;
    }) => {
      const { data } = await recoveryApi.createFailback(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: recoveryKeys().all });
    },
  });
}
