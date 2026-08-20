import { apiClient } from "./http";
import type {
  NotificationItem,
  NotificationListResponse,
  NotificationPreferencesResponse,
} from "../types/api";

export type ListNotificationsParams = {
  unreadOnly?: boolean;
  eventType?: string;
  organizationId?: string;
  limit?: number;
  offset?: number;
};

export type UpdatePreferenceInput = {
  eventType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  organizationId?: string | null;
};

export const notificationApi = {
  list(params?: ListNotificationsParams) {
    return apiClient.get<NotificationListResponse>("/notifications", {
      params: {
        ...params,
        unreadOnly:
          params?.unreadOnly === undefined ? undefined : params.unreadOnly ? "true" : "false",
      },
    });
  },
  history(params?: ListNotificationsParams) {
    return apiClient.get<NotificationListResponse>("/notifications/history", { params });
  },
  unreadCount(organizationId?: string) {
    return apiClient.get<{ unreadCount: number }>("/notifications/unread-count", {
      params: organizationId ? { organizationId } : undefined,
    });
  },
  get(id: string) {
    return apiClient.get<{ notification: NotificationItem }>(`/notifications/${id}`);
  },
  markRead(id: string) {
    return apiClient.post<{ notification: NotificationItem }>(`/notifications/${id}/read`);
  },
  markAllRead(organizationId?: string) {
    return apiClient.post<{ updated: number }>("/notifications/read-all", {
      organizationId,
    });
  },
  remove(id: string) {
    return apiClient.delete<{ ok: boolean }>(`/notifications/${id}`);
  },
  getPreferences() {
    return apiClient.get<NotificationPreferencesResponse>("/notifications/preferences");
  },
  updatePreferences(preferences: UpdatePreferenceInput[]) {
    return apiClient.put<NotificationPreferencesResponse>("/notifications/preferences", {
      preferences,
    });
  },
  adminOverview() {
    return apiClient.get("/notifications/admin/overview");
  },
  adminAnalytics() {
    return apiClient.get("/notifications/admin/analytics");
  },
  adminObservability() {
    return apiClient.get("/notifications/admin/observability");
  },
  adminQueue() {
    return apiClient.get("/notifications/admin/queue");
  },
  adminDelivery() {
    return apiClient.get("/notifications/admin/delivery");
  },
  adminFailures(params?: { limit?: number; offset?: number }) {
    return apiClient.get("/notifications/admin/failures", { params });
  },
  adminOutbox(params: { status: string; limit?: number; offset?: number }) {
    return apiClient.get("/notifications/admin/outbox", { params });
  },
  adminInspectOutbox(id: string) {
    return apiClient.get(`/notifications/admin/outbox/${id}`);
  },
  adminInspectNotification(id: string) {
    return apiClient.get(`/notifications/admin/notifications/${id}`);
  },
  adminRetentionPreview() {
    return apiClient.get("/notifications/admin/retention");
  },
  adminRetentionPurge(body?: {
    deletedNotificationDays?: number;
    terminalOutboxDays?: number;
  }) {
    return apiClient.post("/notifications/admin/retention/purge", body ?? {});
  },
  adminRetryDeadLetters(body?: { ids?: string[]; limit?: number }) {
    return apiClient.post("/notifications/admin/dead-letters/retry", body ?? {});
  },
};
