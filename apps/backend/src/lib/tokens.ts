import jwt from "jsonwebtoken";
import { AppError } from "./errors.js";

export type AccessTokenPayload = {
  sub: string;
  sid: string;
  typ: "access";
};

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET is required");
  }
  return secret;
}

export function signAccessToken(input: { userId: string; sessionId: string }): string {
  const expiresIn = process.env.JWT_ACCESS_EXPIRES_IN ?? "15m";
  return jwt.sign(
    { sub: input.userId, sid: input.sessionId, typ: "access" } satisfies AccessTokenPayload,
    getAccessSecret(),
    { expiresIn } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const payload = jwt.verify(token, getAccessSecret()) as AccessTokenPayload;
    if (payload.typ !== "access" || !payload.sub || !payload.sid) {
      throw new AppError(401, "INVALID_TOKEN", "Invalid access token");
    }
    return payload;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(401, "INVALID_TOKEN", "Invalid or expired access token");
  }
}

export function getRefreshExpiresAt(): Date {
  const days = Number.parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? "30", 10);
  const safeDays = Number.isNaN(days) ? 30 : days;
  return new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000);
}
