import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { regionApi } from "../../services/regionApi";

export function regionKeys() {
  return {
    all: ["regions"] as const,
    list: () => ["regions", "list"] as const,
    routing: (organizationId?: string) => ["regions", "routing", organizationId] as const,
    residency: (organizationId?: string) => ["regions", "residency", organizationId] as const,
  };
}

export function useRegions(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: regionKeys().list(),
    queryFn: async () => {
      const { data } = await regionApi.list();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function useRegionRouting(
  organizationId?: string | null,
  hints?: { clientRegionHint?: string; dataClass?: string },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: regionKeys().routing(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await regionApi.routing({
        organizationId: organizationId!,
        clientRegionHint: hints?.clientRegionHint,
        dataClass: hints?.dataClass,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useResidencyReport(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: regionKeys().residency(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await regionApi.residency(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateRegion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await regionApi.create(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regionKeys().all });
    },
  });
}

export function useRegionFailover() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await regionApi.failover(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: regionKeys().all });
    },
  });
}
