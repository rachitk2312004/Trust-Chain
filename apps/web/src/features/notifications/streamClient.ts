import { NotificationStreamEventTypes, NotificationStreamDefaults } from "@trustchain/config";
import { ApiConstants } from "@trustchain/config";
import { getApiBaseUrl } from "../../lib/apiBase";
import { tokenVault } from "../../lib/tokenVault";
import { useSessionStore } from "../../lib/sessionStore";
import type { NotificationItem } from "../../types/api";

export type NotificationStreamEnvelope = {
  id: string;
  type: string;
  userId: string;
  data: Record<string, unknown>;
  ts: string;
};

export type StreamStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed" | "auth_error";

export type StreamHandlers = {
  onEvent: (envelope: NotificationStreamEnvelope) => void;
  onStatus?: (status: StreamStatus) => void;
};

const CHANNEL_NAME = "trustchain-notifications-stream";
const LEADER_KEY = "trustchain-notifications-leader";

export function buildNotificationStreamUrl(accessToken: string): string {
  const base = `${getApiBaseUrl()}${ApiConstants.prefix}/notifications/stream`;
  const url = new URL(base);
  // EventSource-compatible fallback; fetch client also sends Authorization.
  url.searchParams.set("access_token", accessToken);
  return url.toString();
}

/** Parse one or more SSE frames from a text buffer; returns leftover incomplete chunk. */
export function parseSseChunk(
  buffer: string,
  onFrame: (frame: { id?: string; event?: string; data: string }) => void,
): string {
  const parts = buffer.split("\n\n");
  const incomplete = parts.pop() ?? "";
  for (const part of parts) {
    if (!part.trim()) continue;
    let id: string | undefined;
    let event: string | undefined;
    const dataLines: string[] = [];
    for (const line of part.split("\n")) {
      if (line.startsWith("id:")) id = line.slice(3).trim();
      else if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }
    if (dataLines.length) onFrame({ id, event, data: dataLines.join("\n") });
  }
  return incomplete;
}

export function isDuplicateEventId(seen: Set<string>, id: string, max = 200): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  if (seen.size > max) {
    const first = seen.values().next().value;
    if (first !== undefined) seen.delete(first);
  }
  return false;
}

export function computeReconnectDelay(attempt: number): number {
  const base = NotificationStreamDefaults.baseReconnectDelayMs;
  const max = NotificationStreamDefaults.maxReconnectDelayMs;
  const exp = Math.min(base * 2 ** Math.max(0, attempt - 1), max);
  const jitter = Math.floor(Math.random() * 250);
  return exp + jitter;
}

export type NotificationStreamController = {
  stop: () => void;
  getStatus: () => StreamStatus;
};

/**
 * Opens a fetch-based SSE connection with Authorization + reconnect backoff.
 * Stops permanently on 401.
 */
export function openNotificationStream(handlers: StreamHandlers): NotificationStreamController {
  let stopped = false;
  let status: StreamStatus = "idle";
  let attempt = 0;
  let abort: AbortController | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const setStatus = (next: StreamStatus) => {
    status = next;
    handlers.onStatus?.(next);
  };

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (stopped || status === "auth_error") return;
    clearReconnect();
    attempt += 1;
    // Cap reconnect loops — still reconnect, but with max delay.
    const delay = computeReconnectDelay(Math.min(attempt, 8));
    setStatus("reconnecting");
    reconnectTimer = setTimeout(() => {
      void connect();
    }, delay);
  };

  const connect = async () => {
    if (stopped) return;
    clearReconnect();
    abort?.abort();
    abort = new AbortController();

    const token = tokenVault.getAccessToken() ?? useSessionStore.getState().accessToken;
    if (!token) {
      setStatus("auth_error");
      return;
    }

    setStatus(attempt === 0 ? "connecting" : "reconnecting");

    try {
      const response = await fetch(buildNotificationStreamUrl(token), {
        method: "GET",
        headers: {
          Accept: "text/event-stream",
          Authorization: `Bearer ${token}`,
        },
        signal: abort.signal,
      });

      if (response.status === 401) {
        setStatus("auth_error");
        return;
      }
      if (!response.ok || !response.body) {
        scheduleReconnect();
        return;
      }

      setStatus("open");
      attempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        buffer = parseSseChunk(buffer, (frame) => {
          try {
            const envelope = JSON.parse(frame.data) as NotificationStreamEnvelope;
            if (frame.id && !envelope.id) envelope.id = frame.id;
            if (frame.event && !envelope.type) envelope.type = frame.event;
            if (
              envelope.type === NotificationStreamEventTypes.heartbeat ||
              envelope.type === NotificationStreamEventTypes.connected
            ) {
              return;
            }
            handlers.onEvent(envelope);
          } catch {
            /* ignore malformed */
          }
        });
      }

      if (!stopped && status !== "auth_error") {
        scheduleReconnect();
      }
    } catch (err) {
      if (stopped) return;
      if (err instanceof DOMException && err.name === "AbortError") return;
      scheduleReconnect();
    }
  };

  void connect();

  return {
    stop: () => {
      stopped = true;
      clearReconnect();
      abort?.abort();
      setStatus("closed");
    },
    getStatus: () => status,
  };
}

export type TabMessage =
  | { kind: "stream_event"; envelope: NotificationStreamEnvelope }
  | { kind: "leader_heartbeat"; tabId: string; at: number }
  | { kind: "leader_claim"; tabId: string; at: number };

export function createBroadcastChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  return new BroadcastChannel(CHANNEL_NAME);
}

export function tryClaimStreamLeadership(tabId: string): boolean {
  if (typeof localStorage === "undefined") return true;
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    const now = Date.now();
    if (raw) {
      const parsed = JSON.parse(raw) as { tabId: string; at: number };
      // Stale leader (no heartbeat for 10s) can be replaced.
      if (parsed.tabId !== tabId && now - parsed.at < 10_000) {
        return false;
      }
    }
    localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, at: now }));
    return true;
  } catch {
    return true;
  }
}

export function renewStreamLeadership(tabId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { tabId: string; at: number };
    if (parsed.tabId === tabId) {
      localStorage.setItem(LEADER_KEY, JSON.stringify({ tabId, at: Date.now() }));
    }
  } catch {
    /* ignore */
  }
}

export function releaseStreamLeadership(tabId: string): void {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as { tabId: string };
    if (parsed.tabId === tabId) localStorage.removeItem(LEADER_KEY);
  } catch {
    /* ignore */
  }
}

export function asNotificationItem(value: unknown): NotificationItem | null {
  if (!value || typeof value !== "object") return null;
  const n = value as Partial<NotificationItem>;
  if (typeof n.id !== "string" || typeof n.title !== "string") return null;
  return n as NotificationItem;
}
