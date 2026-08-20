import {
  NotificationStreamDefaults,
  NotificationStreamEventTypes,
} from "@trustchain/config";
import type { Request, Response } from "express";
import { AppError } from "../../lib/errors.js";
import { verifyAccessToken } from "../../lib/tokens.js";
import { findValidSessionById } from "../auth/sessions.repository.js";
import { findUserById } from "../auth/users.repository.js";
import {
  notificationConnections,
  type NotificationConnectionManager,
} from "./notification.connection.js";
import {
  createStreamEnvelope,
  formatSseMessage,
} from "./notification.stream.js";

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

export function startConnectionCleanup(
  manager: NotificationConnectionManager = notificationConnections,
  intervalMs = NotificationStreamDefaults.cleanupIntervalMs,
): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const removed = manager.cleanupStale();
    for (const id of removed) {
      // best-effort; response may already be gone
      void id;
    }
  }, intervalMs);
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function stopConnectionCleanup(): void {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Auth for SSE: Bearer header OR `access_token` query (EventSource cannot set headers).
 */
export async function authenticateStreamRequest(req: Request): Promise<{
  userId: string;
  sessionId: string;
}> {
  const header = req.headers.authorization;
  const queryToken =
    typeof req.query.access_token === "string" ? req.query.access_token.trim() : "";
  const token = header?.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : queryToken;

  if (!token) {
    throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw new AppError(401, "UNAUTHORIZED", "Invalid or expired access token");
  }

  const session = await findValidSessionById(payload.sid);
  if (!session || session.user_id !== payload.sub) {
    throw new AppError(401, "UNAUTHORIZED", "Session is invalid or revoked");
  }

  const user = await findUserById(payload.sub);
  if (!user || user.status === "disabled") {
    throw new AppError(401, "UNAUTHORIZED", "User is not authorized");
  }

  return { userId: user.id, sessionId: session.id };
}

/**
 * Opens an SSE response for the authenticated user.
 */
export async function openNotificationSse(
  req: Request,
  res: Response,
  manager: NotificationConnectionManager = notificationConnections,
): Promise<void> {
  const auth = await authenticateStreamRequest(req);

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  // Allow browser EventSource / fetch from portal origin when not proxied.
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.flushHeaders?.();

  const conn = manager.add({
    userId: auth.userId,
    sessionId: auth.sessionId,
    res,
  });

  startConnectionCleanup(manager);

  const connected = createStreamEnvelope({
    type: NotificationStreamEventTypes.connected,
    userId: auth.userId,
    data: { connectionId: conn.id },
    id: `connected:${conn.id}`,
  });
  res.write(formatSseMessage(connected));

  const heartbeat = setInterval(() => {
    if (conn.closed) {
      clearInterval(heartbeat);
      return;
    }
    const hb = createStreamEnvelope({
      type: NotificationStreamEventTypes.heartbeat,
      userId: auth.userId,
      data: { connectionId: conn.id },
      id: `hb:${conn.id}:${Date.now()}`,
    });
    try {
      res.write(formatSseMessage(hb));
      manager.touch(conn.id);
    } catch {
      clearInterval(heartbeat);
      manager.remove(conn.id);
    }
  }, NotificationStreamDefaults.heartbeatIntervalMs);
  if (typeof heartbeat === "object" && "unref" in heartbeat) {
    heartbeat.unref();
  }

  const close = () => {
    clearInterval(heartbeat);
    manager.remove(conn.id);
    try {
      res.end();
    } catch {
      /* ignore */
    }
  };

  req.on("close", close);
  req.on("aborted", close);
  res.on("close", close);
  res.on("error", close);
}
