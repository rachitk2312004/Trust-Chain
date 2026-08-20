import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { ApiConstants } from "@trustchain/config";
import { getApiBaseUrl } from "../lib/apiBase";
import { getApiErrorMessage } from "../lib/apiErrors";
import { emitAuthEvent } from "../lib/authEvents";
import { useSessionStore } from "../lib/sessionStore";
import { tokenVault } from "../lib/tokenVault";
import type { ApiErrorBody, AuthSessionPayload } from "../types/api";

const MAX_NETWORK_RETRIES = 2;

export const apiClient = axios.create({
  baseURL: `${getApiBaseUrl()}${ApiConstants.prefix}`,
  headers: { "content-type": "application/json" },
  timeout: 30_000,
});

type RetryConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _networkRetry?: number;
};

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenVault.getAccessToken() ?? useSessionStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenVault.getRefreshToken() ?? useSessionStore.getState().refreshToken;
  if (!refreshToken) return null;
  const response = await axios.post<AuthSessionPayload>(
    `${getApiBaseUrl()}${ApiConstants.prefix}/auth/refresh`,
    { refreshToken },
    { headers: { "content-type": "application/json" } },
  );
  const data = response.data;
  useSessionStore.getState().setSession({
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user,
  });
  return data.accessToken;
}

function isAuthExempt(url: string): boolean {
  return (
    url.includes("/auth/refresh") ||
    url.includes("/auth/login") ||
    url.includes("/auth/mfa/verify") ||
    url.includes("/auth/register") ||
    url.includes("/auth/password/")
  );
}

function shouldRetryNetwork(error: AxiosError, config: RetryConfig): boolean {
  if (error.response) {
    const status = error.response.status;
    if (status !== 502 && status !== 503 && status !== 504) return false;
  } else if (error.code !== "ECONNABORTED" && error.message !== "Network Error") {
    return false;
  }
  const attempt = config._networkRetry ?? 0;
  return attempt < MAX_NETWORK_RETRIES;
}

function forceLogout(type: "session-expired" | "forced-logout" | "unauthorized", message?: string) {
  useSessionStore.getState().clearSession();
  emitAuthEvent({ type, message });
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as RetryConfig | undefined;
    if (!original) {
      return Promise.reject(error);
    }

    if (shouldRetryNetwork(error, original)) {
      original._networkRetry = (original._networkRetry ?? 0) + 1;
      const delay = 300 * 2 ** (original._networkRetry - 1);
      await new Promise((r) => setTimeout(r, delay));
      return apiClient.request(original);
    }

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    const url = original.url ?? "";
    if (isAuthExempt(url)) {
      if (url.includes("/auth/refresh")) {
        forceLogout("session-expired", "Your session expired. Sign in again.");
      }
      return Promise.reject(error);
    }

    original._retry = true;
    try {
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const accessToken = await refreshPromise;
      if (!accessToken) {
        forceLogout("session-expired", "Your session expired. Sign in again.");
        return Promise.reject(error);
      }
      original.headers.Authorization = `Bearer ${accessToken}`;
      return apiClient.request(original);
    } catch (refreshError) {
      forceLogout("forced-logout", "Unable to renew your session. Sign in again.");
      return Promise.reject(refreshError);
    }
  },
);

export { getApiErrorMessage, refreshAccessToken };
