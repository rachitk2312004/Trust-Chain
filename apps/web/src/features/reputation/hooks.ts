import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSessionStore } from "../../lib/sessionStore";
import { reputationApi } from "../../services/reputationApi";

export function reputationKeys() {
  return {
    all: ["reputation"] as const,
    list: (organizationId?: string) => ["reputation", "list", organizationId] as const,
    history: (organizationId?: string) => ["reputation", "history", organizationId] as const,
    alerts: (organizationId?: string) => ["reputation", "alerts", organizationId] as const,
    leaderboard: (organizationId?: string, subjectType?: string) =>
      ["reputation", "leaderboard", organizationId, subjectType] as const,
  };
}

export function useReputationList(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: reputationKeys().list(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await reputationApi.list({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useReputationHistory(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: reputationKeys().history(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await reputationApi.history({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useReputationAlerts(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: reputationKeys().alerts(organizationId ?? undefined),
    queryFn: async () => {
      const { data } = await reputationApi.alerts({ organizationId: organizationId! });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useReputationLeaderboard(
  organizationId?: string | null,
  subjectType?: string,
  enabled = true,
) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: reputationKeys().leaderboard(organizationId ?? undefined, subjectType),
    queryFn: async () => {
      const { data } = await reputationApi.leaderboard({
        organizationId: organizationId!,
        subjectType,
      });
      return data;
    },
    enabled: Boolean(accessToken && organizationId && enabled),
  });
}

export function useScoreReputation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await reputationApi.score(body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reputationKeys().all });
    },
  });
}

export function usePatchReputation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
      const { data } = await reputationApi.patch(id, body);
      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reputationKeys().all });
    },
  });
}
