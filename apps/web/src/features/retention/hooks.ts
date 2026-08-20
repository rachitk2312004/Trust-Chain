import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { retentionApi } from "../../services/retentionApi";

export function retentionKeys() {
  return {
    all: ["retention"] as const,
    policies: (organizationId?: string) => ["retention", "policies", organizationId] as const,
    holds: (organizationId?: string) => ["retention", "holds", organizationId] as const,
    status: (organizationId?: string) => ["retention", "status", organizationId] as const,
  };
}

export function useRetentionPolicies(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: retentionKeys().policies(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await retentionApi.listPolicies({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useLegalHolds(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: retentionKeys().holds(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await retentionApi.listHolds({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useRetentionStatus(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: retentionKeys().status(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await retentionApi.status(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateRetentionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await retentionApi.createPolicy(body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: retentionKeys().policies(
          typeof vars.organizationId === "string" ? vars.organizationId : undefined,
        ),
      });
      void queryClient.invalidateQueries({ queryKey: retentionKeys().all });
    },
  });
}

export function useCreateLegalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await retentionApi.createHold(body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: retentionKeys().holds(
          typeof vars.organizationId === "string" ? vars.organizationId : undefined,
        ),
      });
      void queryClient.invalidateQueries({ queryKey: retentionKeys().all });
    },
  });
}

export function usePatchLegalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; body: Record<string, unknown> }) => {
      const { data } = await retentionApi.patchHold(input.id, input.body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: retentionKeys().all });
    },
  });
}

export function useRunRetention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { organizationId: string; dryRun?: boolean; targetType?: string }) => {
      const { data } = await retentionApi.run(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: retentionKeys().all });
    },
  });
}
