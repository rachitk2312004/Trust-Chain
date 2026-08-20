import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "../../services/notificationApi";
import type {
  NotificationAnalytics,
  NotificationObservability,
  DeadLetterList,
  RetentionPreview,
  RetentionPurgeResult,
  NotificationQueueStats,
} from "../../services/notificationOpsTypes";
import { useSessionStore } from "../../lib/sessionStore";
import { usePermissions } from "../../hooks/usePermissions";

export const notificationOpsKeys = {
  overview: ["notifications", "ops", "overview"] as const,
  analytics: ["notifications", "ops", "analytics"] as const,
  observability: ["notifications", "ops", "observability"] as const,
  queue: ["notifications", "ops", "queue"] as const,
  delivery: ["notifications", "ops", "delivery"] as const,
  failures: ["notifications", "ops", "failures"] as const,
  retention: ["notifications", "ops", "retention"] as const,
};

export function useNotificationOpsEnabled() {
  const accessToken = useSessionStore((s) => s.accessToken);
  const { isOpsAdmin } = usePermissions();
  return Boolean(accessToken && isOpsAdmin);
}

export function useNotificationAnalytics() {
  const enabled = useNotificationOpsEnabled();
  return useQuery({
    queryKey: notificationOpsKeys.analytics,
    queryFn: async () => {
      const { data } = await notificationApi.adminAnalytics();
      return data as NotificationAnalytics;
    },
    enabled,
    refetchInterval: 30_000,
  });
}

export function useNotificationObservability() {
  const enabled = useNotificationOpsEnabled();
  return useQuery({
    queryKey: notificationOpsKeys.observability,
    queryFn: async () => {
      const { data } = await notificationApi.adminObservability();
      return data as NotificationObservability;
    },
    enabled,
    refetchInterval: 15_000,
  });
}

export function useNotificationQueueStats() {
  const enabled = useNotificationOpsEnabled();
  return useQuery({
    queryKey: notificationOpsKeys.queue,
    queryFn: async () => {
      const { data } = await notificationApi.adminQueue();
      return data as { queue: NotificationQueueStats; retries: NotificationAnalytics["retries"] };
    },
    enabled,
    refetchInterval: 15_000,
  });
}

export function useNotificationDeliveryStats() {
  const enabled = useNotificationOpsEnabled();
  return useQuery({
    queryKey: notificationOpsKeys.delivery,
    queryFn: async () => {
      const { data } = await notificationApi.adminDelivery();
      return data as {
        delivery: NotificationAnalytics["delivery"];
        channels: NotificationAnalytics["channels"];
        digests: NotificationAnalytics["digests"];
      };
    },
    enabled,
    refetchInterval: 30_000,
  });
}

export function useNotificationFailures() {
  const enabled = useNotificationOpsEnabled();
  return useQuery({
    queryKey: notificationOpsKeys.failures,
    queryFn: async () => {
      const { data } = await notificationApi.adminFailures({ limit: 50, offset: 0 });
      return data as {
        failures: NotificationAnalytics["failures"];
        deadLetters: DeadLetterList;
      };
    },
    enabled,
    refetchInterval: 30_000,
  });
}

export function useNotificationRetentionPreview() {
  const enabled = useNotificationOpsEnabled();
  return useQuery({
    queryKey: notificationOpsKeys.retention,
    queryFn: async () => {
      const { data } = await notificationApi.adminRetentionPreview();
      return data as RetentionPreview;
    },
    enabled,
  });
}

export function useRetryDeadLetters() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input?: { ids?: string[]; limit?: number }) => {
      const { data } = await notificationApi.adminRetryDeadLetters(input);
      return data as { requested: number; recovered: number; ids: string[] };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "ops"] });
    },
  });
}

export function usePurgeNotificationRetention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body?: {
      deletedNotificationDays?: number;
      terminalOutboxDays?: number;
    }) => {
      const { data } = await notificationApi.adminRetentionPurge(body);
      return data as RetentionPurgeResult;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications", "ops"] });
    },
  });
}

export function useInspectOutbox() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await notificationApi.adminInspectOutbox(id);
      return data as { outbox: Record<string, unknown> };
    },
  });
}

export function useInspectNotificationAdmin() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await notificationApi.adminInspectNotification(id);
      return data as { notification: Record<string, unknown> };
    },
  });
}
