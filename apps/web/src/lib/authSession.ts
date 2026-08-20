import type { AuthSessionPayload, LoginResponse, MfaChallengePayload } from "../types/api";
import { isMfaChallenge } from "../types/api";
import { useSessionStore } from "./sessionStore";

export function applyAuthSession(payload: AuthSessionPayload): void {
  useSessionStore.getState().setSession({
    accessToken: payload.accessToken,
    refreshToken: payload.refreshToken,
    user: payload.user,
  });
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
