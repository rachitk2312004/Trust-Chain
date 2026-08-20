/// <reference types="vitest" />
import { describe, expect, it, beforeEach } from "vitest";
import { AxiosError } from "axios";
import { applyAuthSession, clearAuthSession, handleLoginSuccess } from "../../lib/authSession";
import { isAuthFailure, isInvalidCredentials, isRateLimited, parseApiError } from "../../lib/apiErrors";
import { useSessionStore } from "../../lib/sessionStore";
import { isMfaChallenge } from "../../types/api";
import type { ApiErrorBody, AuthSessionPayload, PublicUser } from "../../types/api";

const user: PublicUser = {
  id: "11111111-1111-1111-1111-111111111111",
  email: "user@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "active",
  emailVerifiedAt: null,
  createdAt: new Date().toISOString(),
};

function axiosError(status: number, code: string, message: string): AxiosError<ApiErrorBody> {
  return new AxiosError(message, undefined, undefined, undefined, {
    status,
    statusText: "Error",
    headers: {},
    config: {} as never,
    data: { error: { code, message } },
  });
}

describe("auth session helpers", () => {
  beforeEach(() => {
    clearAuthSession();
  });

  it("stores tokens and user on login success without MFA", () => {
    const payload: AuthSessionPayload = {
      mfaRequired: false,
      accessToken: "access",
      refreshToken: "refresh",
      sessionId: "22222222-2222-2222-2222-222222222222",
      deviceId: null,
      user,
    };
    expect(handleLoginSuccess(payload)).toBe("session");
    const state = useSessionStore.getState();
    expect(state.accessToken).toBe("access");
    expect(state.refreshToken).toBe("refresh");
    expect(state.user?.email).toBe("user@example.com");
    expect(state.isAuthenticated()).toBe(true);
  });

  it("stores MFA challenge without access token", () => {
    const next = handleLoginSuccess({
      mfaRequired: true,
      mfaToken: "mfa-token",
      user,
    });
    expect(next).toBe("mfa");
    const state = useSessionStore.getState();
    expect(state.mfaToken).toBe("mfa-token");
    expect(state.accessToken).toBeNull();
    expect(state.isAuthenticated()).toBe(false);
  });

  it("clears session on logout helper", () => {
    applyAuthSession({
      accessToken: "a",
      refreshToken: "r",
      sessionId: "33333333-3333-3333-3333-333333333333",
      deviceId: null,
      user,
    });
    clearAuthSession();
    expect(useSessionStore.getState().accessToken).toBeNull();
    expect(useSessionStore.getState().user).toBeNull();
  });

  it("applies refreshed tokens", () => {
    applyAuthSession({
      accessToken: "old",
      refreshToken: "old-r",
      sessionId: "44444444-4444-4444-4444-444444444444",
      deviceId: null,
      user,
    });
    applyAuthSession({
      accessToken: "new",
      refreshToken: "new-r",
      sessionId: "55555555-5555-5555-5555-555555555555",
      deviceId: null,
      user,
    });
    expect(useSessionStore.getState().accessToken).toBe("new");
    expect(useSessionStore.getState().refreshToken).toBe("new-r");
  });
});

describe("MFA typing", () => {
  it("detects MFA challenge payloads", () => {
    expect(
      isMfaChallenge({
        mfaRequired: true,
        mfaToken: "x",
        user,
      }),
    ).toBe(true);
    expect(
      isMfaChallenge({
        mfaRequired: false,
        accessToken: "a",
        refreshToken: "r",
        sessionId: "66666666-6666-6666-6666-666666666666",
        deviceId: null,
        user,
      }),
    ).toBe(false);
  });
});

describe("API error parsing", () => {
  it("detects invalid credentials and rate limits", () => {
    expect(isInvalidCredentials(axiosError(401, "INVALID_CREDENTIALS", "bad"))).toBe(true);
    expect(isRateLimited(axiosError(429, "AUTH_RATE_LIMITED", "slow down"))).toBe(true);
    expect(isAuthFailure(axiosError(401, "INVALID_REFRESH_TOKEN", "expired"))).toBe(true);
    expect(parseApiError(axiosError(400, "VALIDATION_ERROR", "nope")).code).toBe("VALIDATION_ERROR");
  });
});

describe("route guard predicates", () => {
  beforeEach(() => clearAuthSession());

  it("treats missing access token as unauthenticated", () => {
    expect(useSessionStore.getState().isAuthenticated()).toBe(false);
  });

  it("treats access token as authenticated for protected routes", () => {
    applyAuthSession({
      accessToken: "access",
      refreshToken: "refresh",
      sessionId: "77777777-7777-7777-7777-777777777777",
      deviceId: null,
      user,
    });
    expect(useSessionStore.getState().isAuthenticated()).toBe(true);
  });

  it("requires mfaToken for MFA route gate", () => {
    expect(useSessionStore.getState().mfaToken).toBeNull();
    useSessionStore.getState().setMfaToken("challenge");
    expect(useSessionStore.getState().mfaToken).toBe("challenge");
  });
});
