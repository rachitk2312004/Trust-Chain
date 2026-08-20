import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { marketplaceApi } from "../../services/marketplaceApi";

export function marketplaceKeys() {
  return {
    all: ["marketplace"] as const,
    list: (organizationId?: string) => ["marketplace", "list", organizationId] as const,
    reviews: (organizationId?: string) => ["marketplace", "reviews", organizationId] as const,
    analytics: (organizationId?: string) =>
      ["marketplace", "analytics", organizationId] as const,
  };
}

export function useMarketplace(
  organizationId?: string | null,
  enabled = true,
  opts?: { publisherOrgId?: string },
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: [
      ...marketplaceKeys().list(organizationId ?? undefined),
      opts?.publisherOrgId,
    ] as const,
    queryFn: async () => {
      const { data } = await marketplaceApi.list({
        organizationId: organizationId!,
        publisherOrgId: opts?.publisherOrgId,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useMarketplaceReviews(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: marketplaceKeys().reviews(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await marketplaceApi.reviews({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useMarketplaceAnalytics(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: marketplaceKeys().analytics(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await marketplaceApi.analytics({
        organizationId: organizationId!,
        publisherOrgId: organizationId!,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function usePublishConnector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await marketplaceApi.publish(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketplaceKeys().all });
    },
  });
}

export function usePatchMarketplaceConnector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await marketplaceApi.patch(id, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketplaceKeys().all });
    },
  });
}

export function useInstallMarketplaceConnector() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      organizationId: string;
      listingId: string;
      version?: string;
      review?: { rating: number; title: string; body?: string };
    }) => {
      const { data } = await marketplaceApi.install(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketplaceKeys().all });
    },
  });
}
