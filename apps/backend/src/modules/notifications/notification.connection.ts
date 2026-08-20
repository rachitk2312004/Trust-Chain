import { randomUUID } from "node:crypto";
import { NotificationStreamDefaults } from "@trustchain/config";
import type { Response } from "express";

export type SseConnection = {
  id: string;
  userId: string;
  sessionId: string;
  res: Response;
  createdAt: number;
  lastActivityAt: number;
  closed: boolean;
};

export type ConnectionManagerOptions = {
  staleMs?: number;
  now?: () => number;
};

/**
 * In-process SSE connection registry (multi-connection per user for multi-tab).
 */
export class NotificationConnectionManager {
  private readonly byId = new Map<string, SseConnection>();
  private readonly byUser = new Map<string, Set<string>>();
  private readonly staleMs: number;
  private readonly now: () => number;

  constructor(options?: ConnectionManagerOptions) {
    this.staleMs = options?.staleMs ?? NotificationStreamDefaults.staleConnectionMs;
    this.now = options?.now ?? Date.now;
  }

  add(input: { userId: string; sessionId: string; res: Response }): SseConnection {
    const conn: SseConnection = {
      id: randomUUID(),
      userId: input.userId,
      sessionId: input.sessionId,
      res: input.res,
      createdAt: this.now(),
      lastActivityAt: this.now(),
      closed: false,
    };
    this.byId.set(conn.id, conn);
    const set = this.byUser.get(input.userId) ?? new Set<string>();
    set.add(conn.id);
    this.byUser.set(input.userId, set);
    return conn;
  }

  touch(connectionId: string): void {
    const conn = this.byId.get(connectionId);
    if (conn && !conn.closed) {
      conn.lastActivityAt = this.now();
    }
  }

  remove(connectionId: string): void {
    const conn = this.byId.get(connectionId);
    if (!conn) return;
    conn.closed = true;
    this.byId.delete(connectionId);
    const set = this.byUser.get(conn.userId);
    if (set) {
      set.delete(connectionId);
      if (set.size === 0) this.byUser.delete(conn.userId);
    }
  }

  get(connectionId: string): SseConnection | undefined {
    return this.byId.get(connectionId);
  }

  listForUser(userId: string): SseConnection[] {
    const ids = this.byUser.get(userId);
    if (!ids) return [];
    const out: SseConnection[] = [];
    for (const id of ids) {
      const conn = this.byId.get(id);
      if (conn && !conn.closed) out.push(conn);
    }
    return out;
  }

  connectionCount(userId?: string): number {
    if (userId) return this.byUser.get(userId)?.size ?? 0;
    return this.byId.size;
  }

  /**
   * Removes connections idle longer than staleMs. Returns removed ids.
   */
  cleanupStale(now = this.now()): string[] {
    const removed: string[] = [];
    for (const conn of this.byId.values()) {
      if (conn.closed || now - conn.lastActivityAt > this.staleMs) {
        removed.push(conn.id);
        this.remove(conn.id);
      }
    }
    return removed;
  }

  clear(): void {
    this.byId.clear();
    this.byUser.clear();
  }
}

export const notificationConnections = new NotificationConnectionManager();
