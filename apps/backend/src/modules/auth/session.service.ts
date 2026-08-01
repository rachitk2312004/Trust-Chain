import type { Request } from "express";
import { AppError } from "../../lib/errors.js";
import { generateOpaqueToken, hashToken } from "../../lib/crypto.js";
import { getRefreshExpiresAt, signAccessToken } from "../../lib/tokens.js";
import { upsertDevice } from "./devices.repository.js";
import {
  createSession,
  findValidSessionByRefreshHash,
  revokeSession,
  rotateSessionRefreshToken,
} from "./sessions.repository.js";
import type { UserRow } from "./users.repository.js";
import { findUserById, toPublicUser } from "./users.repository.js";

export type AuthSessionResult = {
  user: ReturnType<typeof toPublicUser>;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  deviceId: string | null;
};

export async function issueSessionForUser(
  user: UserRow,
  meta: {
    ip?: string | null;
    userAgent?: string | null;
    deviceName?: string;
    fingerprint?: string;
  },
): Promise<AuthSessionResult> {
  const device = await upsertDevice({
    userId: user.id,
    name: meta.deviceName,
    fingerprint: meta.fingerprint,
    userAgent: meta.userAgent ?? undefined,
  });

  const refreshToken = generateOpaqueToken(48);
  const session = await createSession({
    userId: user.id,
    deviceId: device.id,
    refreshTokenHash: hashToken(refreshToken),
    expiresAt: getRefreshExpiresAt(),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const accessToken = signAccessToken({ userId: user.id, sessionId: session.id });

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken,
    sessionId: session.id,
    deviceId: device.id,
  };
}

export async function refreshSession(refreshToken: string): Promise<AuthSessionResult> {
  const session = await findValidSessionByRefreshHash(hashToken(refreshToken));
  if (!session) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const user = await findUserById(session.user_id);
  if (!user || user.status === "disabled") {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid or expired");
  }

  const nextRefreshToken = generateOpaqueToken(48);
  const rotated = await rotateSessionRefreshToken(
    session.id,
    hashToken(nextRefreshToken),
    getRefreshExpiresAt(),
  );

  const accessToken = signAccessToken({ userId: user.id, sessionId: rotated.id });

  return {
    user: toPublicUser(user),
    accessToken,
    refreshToken: nextRefreshToken,
    sessionId: rotated.id,
    deviceId: rotated.device_id,
  };
}

export async function logoutSession(sessionId: string, userId: string): Promise<void> {
  const revoked = await revokeSession(sessionId, userId);
  if (!revoked) {
    throw new AppError(404, "SESSION_NOT_FOUND", "Session not found");
  }
}

export function getRequestMeta(req: Request): {
  ip: string | null;
  userAgent: string | null;
} {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    typeof forwarded === "string"
      ? (forwarded.split(",")[0]?.trim() ?? null)
      : (req.socket.remoteAddress ?? null);
  const userAgent =
    typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null;
  return { ip, userAgent };
}
