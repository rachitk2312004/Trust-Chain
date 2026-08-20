import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationStreamEventTypes } from "@trustchain/config";
import { useSessionStore } from "../../lib/sessionStore";
import type { NotificationListResponse } from "../../types/api";
import {
  asNotificationItem,
  createBroadcastChannel,
  isDuplicateEventId,
  openNotificationStream,
  releaseStreamLeadership,
  renewStreamLeadership,
  tryClaimStreamLeadership,
  type NotificationStreamEnvelope,
  type StreamStatus,
  type TabMessage,
} from "./streamClient";

function applyEnvelopeToCache(
  queryClient: ReturnType<typeof useQueryClient>,
  envelope: NotificationStreamEnvelope,
): void {
  const type = envelope.type;

  if (type === NotificationStreamEventTypes.notificationCreated) {
    const notification = asNotificationItem(envelope.data.notification);
    const unreadCount =
      typeof envelope.data.unreadCount === "number" ? envelope.data.unreadCount : undefined;
    if (!notification) return;

    queryClient.setQueriesData<NotificationListResponse>(
      { queryKey: ["notifications", "list"] },
      (old) => {
        if (!old) return old;
        if (old.notifications.some((n) => n.id === notification.id)) return old;
        return {
          ...old,
          total: old.total + 1,
          unreadCount: unreadCount ?? old.unreadCount + (notification.unread ? 1 : 0),
          notifications: [notification, ...old.notifications],
        };
      },
    );
    if (unreadCount !== undefined) {
      queryClient.setQueriesData<number>(
        { queryKey: ["notifications", "unread"] },
        () => unreadCount,
      );
    }
    return;
  }

  if (type === NotificationStreamEventTypes.notificationRead) {
    const notification = asNotificationItem(envelope.data.notification);
    const unreadCount =
      typeof envelope.data.unreadCount === "number" ? envelope.data.unreadCount : undefined;
    if (!notification) return;
    queryClient.setQueriesData<NotificationListResponse>(
      { queryKey: ["notifications", "list"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          unreadCount: unreadCount ?? old.unreadCount,
          notifications: old.notifications.map((n) =>
            n.id === notification.id ? notification : n,
          ),
        };
      },
    );
    if (unreadCount !== undefined) {
      queryClient.setQueriesData<number>(
        { queryKey: ["notifications", "unread"] },
        () => unreadCount,
      );
    }
    return;
  }

  if (type === NotificationStreamEventTypes.notificationDeleted) {
    const notificationId =
      typeof envelope.data.notificationId === "string" ? envelope.data.notificationId : null;
    const unreadCount =
      typeof envelope.data.unreadCount === "number" ? envelope.data.unreadCount : undefined;
    if (!notificationId) return;
    queryClient.setQueriesData<NotificationListResponse>(
      { queryKey: ["notifications"] },
      (old) => {
        if (!old || !("notifications" in old)) return old;
        return {
          ...old,
          total: Math.max(0, old.total - 1),
          unreadCount: unreadCount ?? old.unreadCount,
          notifications: old.notifications.filter((n) => n.id !== notificationId),
        };
      },
    );
    if (unreadCount !== undefined) {
      queryClient.setQueriesData<number>(
        { queryKey: ["notifications", "unread"] },
        () => unreadCount,
      );
    }
    return;
  }

  if (type === NotificationStreamEventTypes.unreadCountUpdated) {
    const unreadCount =
      typeof envelope.data.unreadCount === "number" ? envelope.data.unreadCount : undefined;
    if (unreadCount === undefined) return;
    queryClient.setQueriesData<number>(
      { queryKey: ["notifications", "unread"] },
      () => unreadCount,
    );
    queryClient.setQueriesData<NotificationListResponse>(
      { queryKey: ["notifications", "list"] },
      (old) => (old ? { ...old, unreadCount } : old),
    );
    return;
  }

  if (type === NotificationStreamEventTypes.notificationDelivered) {
    const notificationId =
      typeof envelope.data.notificationId === "string" ? envelope.data.notificationId : null;
    if (!notificationId) return;
    queryClient.setQueriesData<NotificationListResponse>(
      { queryKey: ["notifications", "list"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          notifications: old.notifications.map((n) =>
            n.id === notificationId ? { ...n, emailStatus: "delivered" } : n,
          ),
        };
      },
    );
  }
}

/**
 * Applies stream envelopes to React Query (deduped) and mirrors via BroadcastChannel.
 */
export function useNotificationSubscription(enabled = true) {
  const queryClient = useQueryClient();
  const seenRef = useRef(new Set<string>());
  const channelRef = useRef(createBroadcastChannel());

  const handle = useCallback(
    (envelope: NotificationStreamEnvelope, fromBroadcast = false) => {
      if (isDuplicateEventId(seenRef.current, envelope.id)) return;
      applyEnvelopeToCache(queryClient, envelope);
      if (!fromBroadcast) {
        channelRef.current?.postMessage({
          kind: "stream_event",
          envelope,
        } satisfies TabMessage);
      }
    },
    [queryClient],
  );

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !enabled) return;
    const onMessage = (event: MessageEvent<TabMessage>) => {
      const msg = event.data;
      if (msg?.kind === "stream_event") {
        handle(msg.envelope, true);
      }
    };
    channel.addEventListener("message", onMessage);
    return () => channel.removeEventListener("message", onMessage);
  }, [enabled, handle]);

  return { handle, seenRef };
}

/**
 * Leader-tab SSE connection with reconnect + BroadcastChannel fan-out for multi-tab sync.
 */
export function useNotificationStream(enabled = true) {
  const accessToken = useSessionStore((s) => s.accessToken);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const { handle } = useNotificationSubscription(enabled);
  const tabIdRef = useRef(
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `tab-${Math.random().toString(36).slice(2)}`,
  );

  useEffect(() => {
    if (!enabled || !accessToken) {
      setStatus("idle");
      return;
    }

    const tabId = tabIdRef.current;
    let controller: ReturnType<typeof openNotificationStream> | null = null;
    let leaderTimer: ReturnType<typeof setInterval> | null = null;
    let retryLeader: ReturnType<typeof setInterval> | null = null;

    const startAsLeader = () => {
      if (controller) return;
      controller = openNotificationStream({
        onEvent: (envelope) => handle(envelope),
        onStatus: setStatus,
      });
      leaderTimer = setInterval(() => renewStreamLeadership(tabId), 3_000);
    };

    const tryLead = () => {
      if (tryClaimStreamLeadership(tabId)) {
        startAsLeader();
      }
    };

    tryLead();
    retryLeader = setInterval(tryLead, 5_000);

    return () => {
      if (retryLeader) clearInterval(retryLeader);
      if (leaderTimer) clearInterval(leaderTimer);
      controller?.stop();
      releaseStreamLeadership(tabId);
    };
  }, [accessToken, enabled, handle]);

  return { status, isLive: status === "open" };
}

export type { StreamStatus, NotificationStreamEnvelope };
