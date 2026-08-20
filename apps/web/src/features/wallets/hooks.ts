import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { walletApi } from "../../services/walletApi";

export function walletKeys() {
  return {
    all: ["wallets"] as const,
    list: (organizationId?: string) => ["wallets", "list", organizationId] as const,
    history: (organizationId?: string) => ["wallets", "history", organizationId] as const,
  };
}

export function useWallets(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: walletKeys().list(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await walletApi.list(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useWalletHistory(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: walletKeys().history(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await walletApi.history(organizationId!);
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useLinkWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await walletApi.link(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys().all });
    },
  });
}

export function useVerifyWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      organizationId: string;
      walletLinkId: string;
      challengeId?: string;
      proof?: string;
    }) => {
      const { data } = await walletApi.verify(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys().all });
    },
  });
}

export function usePatchWallet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await walletApi.patch(id, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys().all });
    },
  });
}

export function useSyncWallets() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      organizationId: string;
      walletLinkId?: string;
      force?: boolean;
    }) => {
      const { data } = await walletApi.sync(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: walletKeys().all });
    },
  });
}
