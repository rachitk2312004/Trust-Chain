import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { developerApi } from "../../services/developerApi";
import type {
  DeveloperCreateKeyInput,
  DeveloperCreateServiceAccountInput,
  DeveloperCreateWebhookInput,
  DeveloperPatchKeyInput,
  DeveloperPatchServiceAccountInput,
  DeveloperPatchWebhookInput,
} from "../../types/api";

export function developerKeys() {
  return {
    all: ["developer"] as const,
    dashboard: (organizationId?: string) =>
      ["developer", "dashboard", organizationId] as const,
    apiKeys: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["developer", "keys", organizationId, filters ?? {}] as const,
    webhooks: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["developer", "webhooks", organizationId, filters ?? {}] as const,
    serviceAccounts: (organizationId?: string) =>
      ["developer", "service-accounts", organizationId] as const,
    webhookDetail: (webhookId?: string) =>
      ["developer", "webhook", webhookId] as const,
    deliveries: (webhookId?: string, filters?: Record<string, unknown>) =>
      ["developer", "deliveries", webhookId, filters ?? {}] as const,
    delivery: (webhookId?: string, deliveryId?: string) =>
      ["developer", "delivery", webhookId, deliveryId] as const,
    usage: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["developer", "usage", organizationId, filters ?? {}] as const,
    analytics: (organizationId?: string, days?: number) =>
      ["developer", "analytics", organizationId, days ?? 30] as const,
    quotas: (organizationId?: string) => ["developer", "quotas", organizationId] as const,
    audit: (organizationId?: string, filters?: Record<string, unknown>) =>
      ["developer", "audit", organizationId, filters ?? {}] as const,
    openapi: (organizationId?: string) =>
      ["developer", "openapi", organizationId] as const,
    sdk: (organizationId?: string) => ["developer", "sdk", organizationId] as const,
  };
}

export function useDeveloperDashboard(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().dashboard(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await developerApi.dashboard(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
    staleTime: 30_000,
  });
}

export function useDeveloperApiKeys(
  organizationId?: string | null,
  filters?: { status?: string },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().apiKeys(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await developerApi.listKeys({
        organizationId: organizationId!,
        status: filters?.status || undefined,
        limit: 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateDeveloperApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeveloperCreateKeyInput) => {
      const { data } = await developerApi.createKey(input);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["developer", "keys", vars.organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: developerKeys().dashboard(vars.organizationId),
      });
    },
  });
}

export function usePatchDeveloperApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keyId: string; body: DeveloperPatchKeyInput; organizationId: string }) => {
      const { data } = await developerApi.patchKey(input.keyId, input.body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["developer", "keys", vars.organizationId],
      });
    },
  });
}

export function useDeleteDeveloperApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keyId: string; organizationId: string }) => {
      const { data } = await developerApi.deleteKey(input.keyId);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["developer", "keys", vars.organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: developerKeys().dashboard(vars.organizationId),
      });
    },
  });
}

export function useDeveloperWebhooks(
  organizationId?: string | null,
  filters?: { status?: string },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().webhooks(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await developerApi.listWebhooks({
        organizationId: organizationId!,
        status: filters?.status || undefined,
        limit: 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateDeveloperWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeveloperCreateWebhookInput) => {
      const { data } = await developerApi.createWebhook(input);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["developer", "webhooks", vars.organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: developerKeys().dashboard(vars.organizationId),
      });
    },
  });
}

export function usePatchDeveloperWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      body: DeveloperPatchWebhookInput;
      organizationId: string;
    }) => {
      const { data } = await developerApi.patchWebhook(input.id, input.body);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["developer", "webhooks", vars.organizationId],
      });
    },
  });
}

export function useDeleteDeveloperWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; organizationId: string }) => {
      const { data } = await developerApi.deleteWebhook(input.id);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: ["developer", "webhooks", vars.organizationId],
      });
      void queryClient.invalidateQueries({
        queryKey: developerKeys().dashboard(vars.organizationId),
      });
    },
  });
}

export function useDeveloperServiceAccounts(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().serviceAccounts(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await developerApi.listServiceAccounts({
        organizationId: organizationId!,
        limit: 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useCreateDeveloperServiceAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: DeveloperCreateServiceAccountInput) => {
      const { data } = await developerApi.createServiceAccount(input);
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: developerKeys().serviceAccounts(vars.organizationId),
      });
      void queryClient.invalidateQueries({
        queryKey: developerKeys().dashboard(vars.organizationId),
      });
    },
  });
}

export function usePatchDeveloperServiceAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      serviceAccountId: string;
      body: DeveloperPatchServiceAccountInput;
      organizationId: string;
    }) => {
      const { data } = await developerApi.patchServiceAccount(
        input.serviceAccountId,
        input.body,
      );
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: developerKeys().serviceAccounts(vars.organizationId),
      });
    },
  });
}

export function useWebhookDetail(webhookId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().webhookDetail(webhookId ?? undefined),
    queryFn: async () => {
      const { data } = await developerApi.getWebhook(webhookId!);
      return data;
    },
    enabled: Boolean(accessToken && webhookId && enabled),
  });
}

export function useWebhookDeliveries(
  webhookId?: string | null,
  filters?: { status?: string },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().deliveries(webhookId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await developerApi.listDeliveries(webhookId!, {
        status: filters?.status,
        limit: 100,
      });
      return data;
    },
    enabled: Boolean(accessToken && webhookId && enabled),
  });
}

export function useWebhookDelivery(
  webhookId?: string | null,
  deliveryId?: string | null,
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().delivery(webhookId ?? undefined, deliveryId ?? undefined),
    queryFn: async () => {
      const { data } = await developerApi.getDelivery(webhookId!, deliveryId!);
      return data;
    },
    enabled: Boolean(accessToken && webhookId && deliveryId && enabled),
  });
}

export function useTestWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      webhookId: string;
      organizationId: string;
      eventType?: string;
      data?: Record<string, unknown>;
    }) => {
      const { data } = await developerApi.testWebhook(input.webhookId, {
        eventType: input.eventType,
        data: input.data,
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: developerKeys().deliveries(vars.webhookId),
      });
      void queryClient.invalidateQueries({
        queryKey: developerKeys().webhookDetail(vars.webhookId),
      });
      void queryClient.invalidateQueries({
        queryKey: ["developer", "webhooks", vars.organizationId],
      });
    },
  });
}

export function useReplayWebhookDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      webhookId: string;
      organizationId: string;
      deliveryId: string;
    }) => {
      const { data } = await developerApi.replayWebhook(input.webhookId, {
        deliveryId: input.deliveryId,
      });
      return data;
    },
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({
        queryKey: developerKeys().deliveries(vars.webhookId),
      });
      void queryClient.invalidateQueries({
        queryKey: developerKeys().webhookDetail(vars.webhookId),
      });
    },
  });
}

export function useDeveloperUsage(
  organizationId?: string | null,
  filters?: { days?: number; apiKeyId?: string },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().usage(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await developerApi.usage({
        organizationId: organizationId!,
        days: filters?.days,
        apiKeyId: filters?.apiKeyId,
        limit: 50,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useDeveloperOpenApi(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().openapi(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await developerApi.openapiJson(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useDeveloperSdk(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().sdk(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await developerApi.sdk(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useDeveloperAnalytics(
  organizationId?: string | null,
  days = 30,
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().analytics(organizationId ?? undefined, days),
    queryFn: async () => {
      const { data } = await developerApi.analytics(organizationId!, days);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
    staleTime: 30_000,
  });
}

export function useDeveloperQuotas(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().quotas(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await developerApi.quotas(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
    staleTime: 30_000,
  });
}

export function useDeveloperAudit(
  organizationId?: string | null,
  filters?: {
    action?: string;
    targetType?: string;
    success?: boolean;
    q?: string;
  },
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: developerKeys().audit(organizationId ?? undefined, filters),
    queryFn: async () => {
      const { data } = await developerApi.audit({
        organizationId: organizationId!,
        ...filters,
        limit: 50,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}
