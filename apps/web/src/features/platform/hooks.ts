import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { platformApi } from "../../services/platformApi";

export function platformKeys() {
  return {
    all: ["platform"] as const,
    health: ["platform", "health"] as const,
    readiness: ["platform", "readiness"] as const,
    configuration: ["platform", "configuration"] as const,
    features: ["platform", "features"] as const,
    metrics: ["platform", "metrics"] as const,
  };
}

export function usePlatformHealth(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: platformKeys().health,
    queryFn: async () => {
      const { data } = await platformApi.health();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function usePlatformReadiness(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: platformKeys().readiness,
    queryFn: async () => {
      const { data } = await platformApi.readiness();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
    staleTime: 60_000,
  });
}

export function usePlatformConfiguration(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: platformKeys().configuration,
    queryFn: async () => {
      const { data } = await platformApi.configuration();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function usePlatformFeatures(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: platformKeys().features,
    queryFn: async () => {
      const { data } = await platformApi.features();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function usePlatformMetrics(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: platformKeys().metrics,
    queryFn: async () => {
      const { data } = await platformApi.metrics();
      return data;
    },
    enabled: Boolean(accessToken && enabled),
  });
}

export function usePatchPlatformConfiguration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      entries: Array<{
        key: string;
        value: Record<string, unknown>;
        description?: string | null;
      }>;
    }) => {
      const { data } = await platformApi.patchConfiguration(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformKeys().all });
    },
  });
}

export function usePatchPlatformFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await platformApi.patchFeature(id, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: platformKeys().all });
    },
  });
}
