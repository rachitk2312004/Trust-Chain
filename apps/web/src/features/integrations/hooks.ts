import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { integrationApi } from "../../services/integrationApi";

export function integrationKeys() {
  return {
    all: ["integrations"] as const,
    list: (organizationId?: string) => ["integrations", "list", organizationId] as const,
    events: (organizationId?: string) => ["integrations", "events", organizationId] as const,
  };
}

export function useIntegrations(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: integrationKeys().list(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await integrationApi.list(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useIntegrationEvents(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: integrationKeys().events(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await integrationApi.events(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await integrationApi.create(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationKeys().all });
    },
  });
}

export function usePatchIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await integrationApi.patch(id, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationKeys().all });
    },
  });
}

export function useIntegrationOAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await integrationApi.oauth(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationKeys().all });
    },
  });
}

export function useSyncIntegrations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      organizationId: string;
      integrationId?: string;
      force?: boolean;
      mode?: string;
    }) => {
      const { data } = await integrationApi.sync(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: integrationKeys().all });
    },
  });
}
