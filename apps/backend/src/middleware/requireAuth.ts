import type { NextFunction, Request, Response } from "express";
import { AppError } from "../lib/errors.js";
import { verifyAccessToken } from "../lib/tokens.js";
import { findUserById, type UserRow } from "../modules/auth/users.repository.js";
import { findValidSessionById } from "../modules/auth/sessions.repository.js";
import {
  listRoleBindingsForUser,
  setCachedRoleBindings,
  type RoleBindingView,
} from "../modules/auth/rbac.repository.js";
import { recordAuthCacheHit } from "@trustchain/database";

export type AuthenticatedRequest = Request & {
  user: UserRow;
  sessionId: string;
  roleBindings: RoleBindingView[];
};

declare module "express-serve-static-core" {
  interface Request {
    user?: UserRow;
    sessionId?: string;
    roleBindings?: RoleBindingView[];
  }
}

type AuthCacheEntry = {
  user: UserRow;
  sessionId: string;
  roleBindings: RoleBindingView[];
  expiresAt: number;
};

const AUTH_CACHE_TTL_MS = 120_000;
const authCache = new Map<string, AuthCacheEntry>();
const authInflight = new Map<string, Promise<AuthCacheEntry>>();

function cacheKey(sessionId: string, userId: string): string {
  return `${sessionId}:${userId}`;
}

async function resolveAuth(
  sessionId: string,
  userId: string,
): Promise<{ entry: AuthCacheEntry; cacheHit: boolean }> {
  const key = cacheKey(sessionId, userId);
  const cached = authCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { entry: cached, cacheHit: true };
  }

  const pending = authInflight.get(key);
  if (pending) {
    const entry = await pending;
    return { entry, cacheHit: true };
  }

  const promise = (async () => {
    const [session, user, roleBindings] = await Promise.all([
      findValidSessionById(sessionId),
      findUserById(userId),
      listRoleBindingsForUser(userId),
    ]);

    if (!session || session.user_id !== userId) {
      authCache.delete(key);
      throw new AppError(401, "UNAUTHORIZED", "Session is invalid or revoked");
    }

    if (!user || user.status === "disabled") {
      authCache.delete(key);
      throw new AppError(401, "UNAUTHORIZED", "User is not authorized");
    }

    setCachedRoleBindings(userId, roleBindings);

    const entry: AuthCacheEntry = {
      user,
      sessionId: session.id,
      roleBindings,
      expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
    };
    authCache.set(key, entry);
    return entry;
  })().finally(() => {
    authInflight.delete(key);
  });

  authInflight.set(key, promise);
  const entry = await promise;
  return { entry, cacheHit: false };
}

/** Bust cached auth after role/membership changes so the next request sees fresh bindings. */
export function clearAuthCacheForUser(userId: string): void {
  const suffix = `:${userId}`;
  for (const key of authCache.keys()) {
    if (key.endsWith(suffix)) {
      authCache.delete(key);
    }
  }
  for (const key of authInflight.keys()) {
    if (key.endsWith(suffix)) {
      authInflight.delete(key);
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new AppError(401, "UNAUTHORIZED", "Missing bearer token");
    }

    const token = header.slice("Bearer ".length).trim();
    const payload = verifyAccessToken(token);
    const authStarted = process.hrtime.bigint();
    const { entry, cacheHit } = await resolveAuth(payload.sid, payload.sub);
    if (process.env.PERF_LOG === "1") {
      recordAuthCacheHit(cacheHit);
      if (res.locals.perf) {
        res.locals.perf.authCacheHit = cacheHit;
        res.locals.perf.authMs += Number(process.hrtime.bigint() - authStarted) / 1_000_000;
      }
    }

    req.user = entry.user;
    req.sessionId = entry.sessionId;
    req.roleBindings = entry.roleBindings;
    next();
  } catch (error) {
    next(error);
  }
}
