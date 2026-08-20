import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationApi } from "../../services/notificationApi";
import type { ListNotificationsParams, UpdatePreferenceInput } from "../../services/notificationApi";
import { useSessionStore } from "../../lib/sessionStore";
import type { NotificationItem, NotificationListResponse } from "../../types/api";

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (params?: ListNotificationsParams) => ["notifications", "list", params] as const,
  history: (params?: ListNotificationsParams) => ["notifications", "history", params] as const,
  detail: (id: string) => ["notifications", "detail", id] as const,
  unread: (organizationId?: string | null) =>
    ["notifications", "unread", organizationId ?? "all"] as const,
  preferences: ["notifications", "preferences"] as const,
};

function patchUnread(
  queryClient: ReturnType<typeof useQueryClient>,
  updater: (count: number) => number,
) {
  queryClient.setQueriesData<number>(
    { queryKey: ["notifications", "unread"] },
    (old) => Math.max(0, updater(typeof old === "number" ? old : 0)),
  );
}

export function useNotifications(params?: ListNotificationsParams, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: notificationKeys.list(params),
    queryFn: async () => {
      const { data } = await notificationApi.list(params);
      return data;
    },
    enabled: enabled && Boolean(accessToken),
    refetchInterval: enabled ? 120_000 : false,
  });
}

export function useNotificationHistory(params?: ListNotificationsParams) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: notificationKeys.history(params),
    queryFn: async () => {
      const { data } = await notificationApi.history(params);
      return data;
    },
    enabled: Boolean(accessToken),
  });
}

export function useUnreadCount(organizationId?: string | null, enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: notificationKeys.unread(organizationId),
    queryFn: async () => {
      const { data } = await notificationApi.unreadCount(organizationId ?? undefined);
      return data.unreadCount;
    },
    enabled: enabled && Boolean(accessToken),
    refetchInterval: false,
    staleTime: 5 * 60_000,
    refetchOnMount: false,
  });
}

/**
 * Unread badge counter with live stream awareness (pair with useNotificationStream in the shell).
 * Defer the initial fetch until idle so org page loads are not blocked on badge count.
 */
export function useUnreadCounter(organizationId?: string | null) {
  const unread = useUnreadCount(organizationId, useDeferredUnreadFetch());
  return {
    count: unread.data ?? 0,
    isLoading: unread.isLoading,
    isError: unread.isError,
    refetch: unread.refetch,
    isFetching: unread.isFetching,
  };
}

function useDeferredUnreadFetch(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(() => setReady(true), { timeout: 2000 });
      return () => cancelIdleCallback(id);
    }
    const id = window.setTimeout(() => setReady(true), 250);
    return () => window.clearTimeout(id);
  }, []);
  return ready;
}

export function useNotification(id: string | undefined) {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: notificationKeys.detail(id ?? ""),
    queryFn: async () => {
      const { data } = await notificationApi.get(id!);
      return data.notification;
    },
    enabled: Boolean(accessToken && id),
  });
}

export function useNotificationPreferences() {
  const accessToken = useSessionStore((s) => s.accessToken);
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: async () => {
      const { data } = await notificationApi.getPreferences();
      return data;
    },
    enabled: Boolean(accessToken),
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (preferences: UpdatePreferenceInput[]) => {
      const { data } = await notificationApi.updatePreferences(preferences);
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(notificationKeys.preferences, data);
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await notificationApi.markRead(id);
      return data.notification;
    },
    onSuccess: (notification) => {
      queryClient.setQueryData(notificationKeys.detail(notification.id), notification);
      queryClient.setQueriesData<NotificationListResponse>(
        { queryKey: ["notifications", "list"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            notifications: old.notifications.map((n) =>
              n.id === notification.id ? notification : n,
            ),
            unreadCount: Math.max(0, old.unreadCount - (notification.unread ? 0 : 1)),
          };
        },
      );
      patchUnread(queryClient, (c) => c - 1);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (organizationId?: string) => {
      const { data } = await notificationApi.markAllRead(organizationId);
      return data;
    },
    onSuccess: () => {
      queryClient.setQueriesData<number>({ queryKey: ["notifications", "unread"] }, () => 0);
      queryClient.setQueriesData<NotificationListResponse>(
        { queryKey: ["notifications", "list"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            unreadCount: 0,
            notifications: old.notifications.map((n) => ({
              ...n,
              unread: false,
              readAt: n.readAt ?? new Date().toISOString(),
            })),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await notificationApi.remove(id);
      return id;
    },
    onSuccess: (id) => {
      queryClient.setQueriesData<NotificationListResponse>(
        { queryKey: ["notifications"] },
        (old) => {
          if (!old || !("notifications" in old)) return old;
          const removed = old.notifications.find((n) => n.id === id);
          return {
            ...old,
            total: Math.max(0, old.total - 1),
            unreadCount: removed?.unread
              ? Math.max(0, old.unreadCount - 1)
              : old.unreadCount,
            notifications: old.notifications.filter((n) => n.id !== id),
          };
        },
      );
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export type { NotificationItem };
