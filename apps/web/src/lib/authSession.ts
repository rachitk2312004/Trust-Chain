import type { AuthSessionPayload, LoginResponse, MfaChallengePayload } from "../types/api";
import { isMfaChallenge } from "../types/api";
import { useSessionStore } from "./sessionStore";

/** Full login/MFA session — clears roles so /me can reload them cleanly. */
export function applyAuthSession(payload: AuthSessionPayload): void {
  useSessionStore.getState().setSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  });
}

/** Token rotation only — must preserve roles (used by refresh). */
export function rotateAuthTokens(payload: AuthSessionPayload): void {
  useSessionStore.getState().setTokens({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
  });
  useSessionStore.getState().setUser(payload.user);
}

export function handleLoginSuccess(data: LoginResponse): "mfa" | "session" {
  if (isMfaChallenge(data)) {
    useSessionStore.getState().setMfaToken(data.mfaToken);
    useSessionStore.getState().setUser(data.user);
    return "mfa";
  }
  applyAuthSession(data);
  return "session";
}

export function clearAuthSession(): void {
  useSessionStore.getState().clearSession();
}

export type { MfaChallengePayload };
